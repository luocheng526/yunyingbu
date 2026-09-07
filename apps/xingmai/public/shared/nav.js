/* xm-shell-always 0.1.19 */
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

  if (!document.querySelector('link[href="/shared/layout.css"]')) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/shared/layout.css";
    document.head.appendChild(css);
  }

  const current = window.location.pathname.replace(/\/+$/, "") || "/";
  const currentLabel = (
    items.find(function (item) {
      return (item.href.replace(/\/+$/, "") || "/") === current;
    }) || items[0]
  ).label;

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

  function bindChrome(userLabel) {
    document.documentElement.classList.remove("xm-collapsed");
    const nameEl = document.getElementById("xm-username");
    if (nameEl) {
      nameEl.textContent = userLabel;
    }
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
    document.querySelectorAll(".xm-menu-item").forEach(function (a) {
      a.addEventListener("click", function (event) {
        if (a.getAttribute("data-self") === "1") {
          event.preventDefault();
        }
      });
    });
  }

  function mountShell(userLabel) {
    if (document.querySelector(".xm-shell")) {
      stripInnerChrome(document.querySelector(".xm-content") || document.body);
      bindChrome(userLabel);
      tickChinaClocks();
      rewriteTimeNodes(document.querySelector(".xm-content"));
      if (!window.__xmChinaClock) {
        window.__xmChinaClock = setInterval(tickChinaClocks, 1000);
      }
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
      currentLabel +
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
    tickChinaClocks();
    rewriteTimeNodes(document.querySelector(".xm-content"));
    if (!window.__xmChinaClock) {
      window.__xmChinaClock = setInterval(tickChinaClocks, 1000);
    }
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

  start("…");

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
      const name = payload.displayName || payload.username || "用户";
      const el = document.getElementById("xm-username");
      if (el) {
        el.textContent = name;
      }
    })
    .catch(function () {});
})();
