/* xm-home-sider 0.1.83-restore */
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
  const ICO_PATH = {
    "/": '<path d="M4 11 12 4l8 7"/><path d="M6 10.5V20h4.2v-5.2h3.6V20H18v-9.5"/>',
    "/data": '<path d="M5 19V10"/><path d="M10 19V6"/><path d="M15 19v-7"/><path d="M20 19V8"/>',
    "/shen": '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h4"/>',
    "/han": '<path d="M8 11.5 12 5l4 6.5"/><path d="M6.5 13h11l-1.2 6H7.7z"/>',
    "/people": '<circle cx="9" cy="8" r="2.2"/><path d="M4.8 18c.4-2.4 2.2-3.8 4.2-3.8s3.8 1.4 4.2 3.8"/><circle cx="16.2" cy="8.4" r="1.8"/><path d="M15 14.4c1.7.2 3 1.3 3.4 3.1"/>',
    "/releases": '<path d="M12 4v10"/><path d="M8.5 7.5 12 4l3.5 3.5"/><rect x="6" y="14" width="12" height="6" rx="1"/>',
    "/me": '<circle cx="12" cy="8" r="2.6"/><path d="M6.2 18.5c.6-2.8 2.8-4.3 5.8-4.3s5.2 1.5 5.8 4.3"/>',
    logout: '<path d="M10 7V5.8A1.8 1.8 0 0 1 11.8 4h6.4A1.8 1.8 0 0 1 20 5.8v12.4a1.8 1.8 0 0 1-1.8 1.8h-6.4A1.8 1.8 0 0 1 10 18.2V17"/><path d="M4 12h10"/><path d="M11.2 8.8 14.4 12l-3.2 3.2"/>'
  };

  function ico(name) {
    const path = ICO_PATH[name] || ICO_PATH["/"];
    return (
      '<i class="xm-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      path +
      "</svg></i>"
    );
  }

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
      ">" +
      ico(item.href) +
      "<span>" +
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
      '<button type="button" class="xm-menu-item xm-logout" id="xm-logout">' +
      ico("logout") +
      "<span>退出登录</span></button>" +
      '<p class="xm-version">v0.4.5</p></nav>'
    );
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

  function paintSider(sider) {
    const node = sider || document.createElement("aside");
    node.className = "xm-sider";
    node.setAttribute("aria-label", "侧栏导航");
    node.innerHTML = siderHtml();
    return node;
  }

  function mountShell() {
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
