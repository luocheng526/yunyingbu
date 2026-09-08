/* xm-home-sider v0.4.5 */
(function () {
  const LOGO_SRC = "data:image/png;base64,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";
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

  const MAIN = items.slice(0, 5);
  const FOOT = items.slice(5);

  function itemHtml(item) {
    const cls = "xm-menu-item" + (isActive(item.href) ? " is-active" : "");
    const cur = isActive(item.href) ? ' aria-current="page"' : "";
    return (
      '<a class="' +
      cls +
      '" href="' +
      item.href +
      '"' +
      cur +
      '><i class="xm-ico" aria-hidden="true"></i><span>' +
      item.label +
      "</span></a>"
    );
  }

  function siderHtml() {
    return (
      '<div class="xm-brand"><a class="xm-logo" href="/"><img src="' +
      LOGO_SRC +
      '" alt="星脉甄选" onerror="this.onerror=null;this.src=\'/login-logo.png\'" /></a>' +
      '<button type="button" class="xm-collapse" id="xm-collapse" aria-label="折叠侧栏">‹</button></div>' +
      '<nav class="xm-menu xm-menu-main"><p class="xm-menu-label">项目</p>' +
      MAIN.map(itemHtml).join("") +
      "</nav>" +
      '<nav class="xm-menu xm-menu-foot">' +
      FOOT.map(itemHtml).join("") +
      '<button type="button" class="xm-menu-item xm-logout" id="xm-logout"><i class="xm-ico" aria-hidden="true"></i><span>退出登录</span></button>' +
      '<p class="xm-version">v0.4.5</p></nav>'
    );
  }

  function paintSider(sider) {
    const node = sider || document.createElement("aside");
    node.className = "xm-sider";
    node.setAttribute("aria-label", "侧栏导航");
    node.innerHTML = siderHtml();
    return node;
  }

  function ensureLayoutCss() {
    if (document.querySelector('link[href*="/shared/layout.css"]')) {
      return;
    }
    if (document.getElementById("xm-home-layout")) {
      return;
    }
    const link = document.createElement("link");
    link.id = "xm-home-layout";
    link.rel = "stylesheet";
    link.href = "/shared/layout.css";
    document.head.appendChild(link);
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
    ensureLayoutCss();
    const existingShell = document.querySelector(".xm-shell");
    if (existingShell) {
      document.body.classList.add("xm-app");
      const sider = existingShell.querySelector(".xm-sider");
      if (sider) {
        paintSider(sider);
      } else {
        existingShell.insertBefore(paintSider(null), existingShell.firstChild);
      }
      bindChrome();
      return;
    }

    const existingSider = document.querySelector(".xm-sider");
    const shell = document.createElement("div");
    shell.className = "xm-shell";
    shell.innerHTML =
      '<div class="xm-main">' +
      '<header class="xm-topbar">' +
      '<div class="xm-tabs" aria-label="页签"><span class="xm-tab is-active">' +
      currentLabel +
      "</span></div>" +
      '<div class="xm-user">' +
      '<span class="xm-username" id="xm-username">用户</span>' +
      "</div></header>" +
      '<div class="xm-content" id="xm-content"></div></div>';

    if (existingSider) {
      shell.insertBefore(paintSider(existingSider), shell.firstChild);
    } else {
      shell.insertBefore(paintSider(null), shell.firstChild);
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
