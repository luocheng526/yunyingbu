(function () {
  const ROUTES = ["/", "/data", "/shen", "/han", "/people", "/releases", "/me"];
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

  const current = window.location.pathname.replace(/\/+$/, "") || "/";
  const currentLabel = (items.find(function (item) {
    return normalize(item.href) === current;
  }) || items[0]).label;
  const warmed = Object.create(null);

  function normalize(href) {
    return String(href || "/").replace(/\/+$/, "") || "/";
  }

  function isActive(href) {
    return current === normalize(href);
  }

  function menuHtml() {
    return items
      .map(function (item) {
        const cls = "xm-menu-item" + (isActive(item.href) ? " is-active" : "");
        const cur = isActive(item.href) ? ' aria-current="page"' : "";
        return (
          '<a class="' +
          cls +
          '" href="' +
          item.href +
          '"' +
          cur +
          "><span>" +
          item.label +
          "</span></a>"
        );
      })
      .join("");
  }

  function prefetch(href) {
    const key = normalize(href);
    if (!ROUTES.includes(key) || isActive(key) || warmed[key]) {
      return;
    }
    warmed[key] = true;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "document";
    link.href = key;
    document.head.appendChild(link);
    fetch(key, {
      credentials: "same-origin",
      headers: { Accept: "text/html" }
    }).catch(function () {
      /* keep click navigation */
    });
  }

  function bindMenu(root) {
    const scope = root || document;
    const links = scope.querySelectorAll('.xm-menu a[href], a.xm-logo[href="/"]');
    Array.prototype.forEach.call(links, function (anchor) {
      if (anchor.dataset.navFast === "1") {
        return;
      }
      anchor.dataset.navFast = "1";
      const href = anchor.getAttribute("href");
      const warm = function () {
        prefetch(href);
      };
      anchor.addEventListener("mouseenter", warm);
      anchor.addEventListener("mousedown", warm);
      anchor.addEventListener("touchstart", warm, { passive: true });
      anchor.addEventListener("click", function (event) {
        if (isActive(href)) {
          event.preventDefault();
        }
      });
    });
  }

  function applyCollapsed(collapsed) {
    document.documentElement.classList.toggle("xm-collapsed", collapsed);
    const btn = document.getElementById("xm-collapse");
    if (btn) {
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.setAttribute("aria-label", collapsed ? "展开侧栏" : "折叠侧栏");
    }
  }

  function bindChrome(userLabel) {
    const nameEl = document.getElementById("xm-username");
    if (nameEl && userLabel) {
      nameEl.textContent = userLabel;
    }
    const collapseBtn = document.getElementById("xm-collapse");
    if (collapseBtn && !collapseBtn.dataset.bound) {
      collapseBtn.dataset.bound = "1";
      collapseBtn.addEventListener("click", function () {
        const next = !document.documentElement.classList.contains("xm-collapsed");
        try {
          localStorage.setItem("xm-sider-collapsed", next ? "1" : "0");
        } catch (_err) {
          /* ignore */
        }
        applyCollapsed(next);
      });
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
    try {
      applyCollapsed(localStorage.getItem("xm-sider-collapsed") === "1");
    } catch (_err) {
      applyCollapsed(false);
    }
    bindMenu(document);
  }

  function mountShell() {
    if (document.querySelector(".xm-shell")) {
      document.body.classList.add("xm-app");
      bindChrome();
      return;
    }

    const existingSider = document.querySelector(".xm-sider");
    const shell = document.createElement("div");
    shell.className = "xm-shell";
    shell.innerHTML =
      '<div class="xm-main">' +
      '<header class="xm-topbar">' +
      '<button type="button" class="xm-collapse" id="xm-collapse" aria-label="折叠侧栏">☰</button>' +
      '<div class="xm-tabs" aria-label="页签"><span class="xm-tab is-active">' +
      currentLabel +
      "</span></div>" +
      '<div class="xm-user">' +
      '<span class="xm-username" id="xm-username">用户</span>' +
      '<button type="button" class="xm-logout" id="xm-logout">退出</button>' +
      "</div></header>" +
      '<div class="xm-content" id="xm-content"></div></div>';

    if (existingSider) {
      shell.insertBefore(existingSider, shell.firstChild);
    } else {
      const sider = document.createElement("aside");
      sider.className = "xm-sider";
      sider.setAttribute("aria-label", "侧栏导航");
      sider.innerHTML =
        '<a class="xm-logo" href="/"><span class="xm-logo-mark">星</span><span class="xm-logo-text">星脉管理系统</span></a>' +
        '<nav class="xm-menu">' +
        menuHtml() +
        "</nav>";
      shell.insertBefore(sider, shell.firstChild);
    }

    const content = shell.querySelector("#xm-content");
    const leftovers = [];
    Array.prototype.slice.call(document.body.childNodes).forEach(function (node) {
      if (node === shell) {
        return;
      }
      if (node.id === "site-nav") {
        return;
      }
      if (node.classList && node.classList.contains("xm-sider")) {
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
    document.body.insertBefore(shell, document.body.firstChild);
    document.body.classList.add("xm-app");
    bindChrome();
  }

  function paintNow() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", paintNow);
      return;
    }
    mountShell();
    ROUTES.forEach(function (href) {
      if (!isActive(href)) {
        prefetch(href);
      }
    });
  }

  paintNow();

  fetch("/api/auth/me", { credentials: "same-origin", headers: { Accept: "application/json" } })
    .then(function (res) {
      if (res.status === 401) {
        window.location.replace("/login");
        return null;
      }
      if (!res.ok) {
        return null;
      }
      return res.json();
    })
    .then(function (payload) {
      if (!payload) {
        return;
      }
      bindChrome(payload.displayName || payload.username || "用户");
    })
    .catch(function () {
      /* keep painted shell */
    });
})();
