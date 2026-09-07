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
  if (document.querySelector(".oc-tab, .oc-crumb, #pane-queue")) {
    return;
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

  function applyCollapsed(collapsed) {
    document.documentElement.classList.toggle("xm-collapsed", collapsed);
    const btn = document.getElementById("xm-collapse");
    if (btn) {
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.setAttribute("aria-label", collapsed ? "展开侧栏" : "折叠侧栏");
    }
  }

  function prefetch(href) {
    if (!href || href === current) {
      return;
    }
    if (document.querySelector('link[rel="prefetch"][href="' + href + '"]')) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    document.head.appendChild(link);
  }

  function bindChrome(userLabel) {
    const nameEl = document.getElementById("xm-username");
    if (nameEl) {
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
    document.querySelectorAll(".xm-menu-item").forEach(function (a) {
      a.addEventListener("mouseenter", function () {
        prefetch(a.getAttribute("href"));
      });
      a.addEventListener("click", function (event) {
        if (a.getAttribute("data-self") === "1") {
          event.preventDefault();
        }
      });
    });
    try {
      applyCollapsed(localStorage.getItem("xm-sider-collapsed") === "1");
    } catch (_err) {
      applyCollapsed(false);
    }
  }

  function mountShell(userLabel) {
    if (document.querySelector(".xm-shell")) {
      bindChrome(userLabel);
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
      '<button type="button" class="xm-collapse" id="xm-collapse" aria-label="折叠侧栏">☰</button>' +
      '<div class="xm-tabs" aria-label="页签"><span class="xm-tab is-active">' +
      currentLabel +
      "</span></div>" +
      '<div class="xm-user">' +
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
      if (node.id === "site-nav" || (node.classList && (node.classList.contains("xm-sider") || node.classList.contains("sidebar")))) {
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
    content.querySelectorAll(".site-header, aside.sidebar, .ant-layout-sider, .ant-pro-sider").forEach(function (el) {
      el.remove();
    });
    document.body.insertBefore(shell, document.body.firstChild);
    document.body.classList.add("xm-app");
    bindChrome(userLabel);
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
  items.forEach(function (item) {
    prefetch(item.href);
  });

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
