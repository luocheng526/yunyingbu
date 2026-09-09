/* xm-fast-shell 0.1.107 */
(function () {
  const ASSET_VER = "0.1.107";
  const TAB_TITLE = "星脉甄选运营中心";
  const MODULES = {
    "/data": "data",
    "/data/overview": "data",
    "/data/shops": "data",
    "/data/goods": "data",
    "/data/paid": "data",
    "/shen": "shen",
    "/shen/selection": "shen",
    "/shen/growth": "shen",
    "/shen/paid": "shen",
    "/shen/training": "shen",
    "/shen/tasks": "shen",
    "/han": "han",
    "/han/selection": "han",
    "/han/goods": "han",
    "/han/paid": "han",
    "/han/training": "han",
    "/people": "people",
    "/academy": "academy",
    "/agents": "agents",
    "/releases": "releases",
    "/me": "me"
  };
  const DATA_CHILDREN = [
    { href: "/data/overview", label: "数据总揽" },
    { href: "/data/shops", label: "店铺数据" },
    { href: "/data/goods", label: "商品数据" },
    { href: "/data/paid", label: "实时付费" }
  ];
  const SHEN_CHILDREN = [
    { href: "/shen/selection", label: "选品中心" },
    { href: "/shen/growth", label: "商品成长" },
    { href: "/shen/paid", label: "实时付费" },
    { href: "/shen/training", label: "培训系统" },
    { href: "/shen/tasks", label: "任务管理" }
  ];
  const HAN_CHILDREN = [
    { href: "/han/selection", label: "选品数据" },
    { href: "/han/goods", label: "商品数据" },
    { href: "/han/paid", label: "实时付费" },
    { href: "/han/training", label: "培训系统" }
  ];
  const items = [
    { href: "/data", label: "数据中心", children: DATA_CHILDREN },
    { href: "/shen", label: "沈子晗运营中心", children: SHEN_CHILDREN },
    { href: "/han", label: "韩梦凯运营中心", children: HAN_CHILDREN },
    { href: "/people", label: "人员管理" },
    { href: "/academy", label: "甄选商学院" },
    { href: "/agents", label: "甄选智能体" },
    { href: "/releases", label: "版本发布中心" },
    { href: "/me", label: "个人中心" }
  ];
  const labels = items.concat(DATA_CHILDREN, SHEN_CHILDREN, HAN_CHILDREN);

  const path = (window.location.pathname.replace(/\/+$/, "") || "/").toLowerCase();
  if (path === "/login" || path === "/login.html") {
    return;
  }
  if (document.body && document.body.classList.contains("login-page")) {
    return;
  }

  let current = window.location.pathname.replace(/\/+$/, "") || "/";
  const ICO_PATH = {
    "/data": '<path d="M5 19V10"/><path d="M10 19V6"/><path d="M15 19v-7"/><path d="M20 19V8"/>',
    "/shen": '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h4"/>',
    "/han": '<path d="M8 11.5 12 5l4 6.5"/><path d="M6.5 13h11l-1.2 6H7.7z"/>',
    "/people": '<circle cx="9" cy="8" r="2.2"/><path d="M4.8 18c.4-2.4 2.2-3.8 4.2-3.8s3.8 1.4 4.2 3.8"/><circle cx="16.2" cy="8.4" r="1.8"/><path d="M15 14.4c1.7.2 3 1.3 3.4 3.1"/>',
    "/academy": '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h6"/>',
    "/agents": '<rect x="6" y="8" width="12" height="10" rx="2"/><path d="M12 8V5"/><circle cx="9.5" cy="13" r="1"/><circle cx="14.5" cy="13" r="1"/><path d="M9 19v1h6v-1"/>',
    "/releases": '<path d="M12 4v10"/><path d="M8.5 7.5 12 4l3.5 3.5"/><rect x="6" y="14" width="12" height="6" rx="1"/>',
    "/me": '<circle cx="12" cy="8" r="2.6"/><path d="M6.2 18.5c.6-2.8 2.8-4.3 5.8-4.3s5.2 1.5 5.8 4.3"/>',
    logout: '<path d="M10 7V5.8A1.8 1.8 0 0 1 11.8 4h6.4A1.8 1.8 0 0 1 20 5.8v12.4a1.8 1.8 0 0 1-1.8 1.8h-6.4A1.8 1.8 0 0 1 10 18.2V17"/><path d="M4 12h10"/><path d="M11.2 8.8 14.4 12l-3.2 3.2"/>'
  };

  function normalize(href) {
    return String(href || "/").replace(/\/+$/, "") || "/";
  }

  function isActive(href) {
    return current === normalize(href);
  }

  function labelOf(href) {
    const key = normalize(href);
    const hit = labels.find(function (item) {
      return normalize(item.href) === key;
    });
    return (hit || items[0]).label;
  }

  function groupOpen(prefix, href) {
    const key = normalize(href);
    return key === prefix || key.indexOf(prefix + "/") === 0;
  }

  const MAIN = items.slice(0, 6);
  const FOOT = items.slice(6);

  function ico(name) {
    const path = ICO_PATH[name] || ICO_PATH["/data"];
    return (
      '<i class="xm-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      path +
      "</svg></i>"
    );
  }

  function itemHtml(item) {
    const cls = "xm-menu-item" + (isActive(item.href) ? " is-active" : "");
    const cur = isActive(item.href) ? ' aria-current="page"' : "";
    const badge =
      item.href === "/releases" ? '<b class="xm-queue-badge" data-xm-queue-badge hidden>0</b>' : "";
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
      "</span>" +
      badge +
      "</a>"
    );
  }

  function groupHtml(item) {
    const open = groupOpen(item.href, current);
    const kids = (item.children || []).map(itemHtml).join("");
    return (
      '<div class="xm-menu-group' +
      (open ? " is-open" : "") +
      '" data-xm-group="' +
      item.href +
      '">' +
      '<button type="button" class="xm-menu-item xm-menu-parent" aria-expanded="' +
      (open ? "true" : "false") +
      '">' +
      ico(item.href) +
      "<span>" +
      item.label +
      "</span>" +
      '<i class="xm-caret" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 10 4 4 4-4"/></svg></i>' +
      "</button>" +
      '<div class="xm-submenu">' +
      kids +
      "</div></div>"
    );
  }

  function mainHtml() {
    return MAIN.map(function (item) {
      return item.children ? groupHtml(item) : itemHtml(item);
    }).join("");
  }

  function siderHtml() {
    return (
      '<div class="xm-brand"><a class="xm-logo" href="/data"><img src="/login-logo.png" alt="星脉甄选" onerror="this.onerror=null;this.src=\'/shared/xingmai-logo.png\'" /></a>' +
      '<button type="button" class="xm-collapse" id="xm-collapse" aria-label="折叠侧栏">‹</button></div>' +
      '<nav class="xm-menu xm-menu-main">' +
      mainHtml() +
      "</nav>" +
      '<nav class="xm-menu xm-menu-foot">' +
      FOOT.map(itemHtml).join("") +
      '<button type="button" class="xm-menu-item xm-logout" id="xm-logout">' +
      ico("logout") +
      "<span>退出登录</span></button>" +
      '<p class="xm-version">v0.4.12</p></nav>'
    );
  }

  function contentRoot() {
    return document.getElementById("xm-content") || document.querySelector(".xm-content");
  }

  function alreadyMounted(root, href) {
    if (!root) {
      return false;
    }
    if (root.getAttribute("data-xm-mounted") === href) {
      return true;
    }
    if (href === "/releases" && (root.getAttribute("data-xm-rel-mounted") === "1" || root.querySelector(".oc-wrap"))) {
      return true;
    }
    return false;
  }

  function paintQueueBadge(count) {
    const n = Math.max(0, Number(count) || 0);
    const badges = document.querySelectorAll("[data-xm-queue-badge]");
    Array.prototype.forEach.call(badges, function (el) {
      if (n <= 0) {
        el.hidden = true;
        el.textContent = "0";
        el.removeAttribute("aria-label");
        return;
      }
      const text = n > 99 ? "99+" : String(n);
      el.hidden = false;
      el.textContent = text;
      el.setAttribute("aria-label", text + " 条待放行");
    });
  }

  function refreshQueueBadge() {
    fetch("/api/releases/queue", {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    })
      .then(function (res) {
        if (!res.ok) {
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (!data) {
          return;
        }
        const items = data.items || [];
        paintQueueBadge(Array.isArray(items) ? items.length : 0);
      })
      .catch(function () {
        /* keep last count */
      });
  }

  function startQueueWatch() {
    if (window.__xmQueueWatch) {
      refreshQueueBadge();
      return;
    }
    window.__xmQueueWatch = 1;
    refreshQueueBadge();
    setInterval(refreshQueueBadge, 20000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        refreshQueueBadge();
      }
    });
  }

  function paintActive(href) {
    current = normalize(href);
    const links = document.querySelectorAll(".xm-menu a[href]");
    Array.prototype.forEach.call(links, function (anchor) {
      const dest = normalize(anchor.getAttribute("href"));
      const on = dest === current;
      anchor.classList.toggle("is-active", on);
      if (on) {
        anchor.setAttribute("aria-current", "page");
      } else {
        anchor.removeAttribute("aria-current");
      }
    });
    const tab = document.querySelector(".xm-tab");
    if (tab) {
      tab.textContent = labelOf(current);
    }
    document.title = TAB_TITLE;
    const groups = document.querySelectorAll(".xm-menu-group[data-xm-group]");
    Array.prototype.forEach.call(groups, function (group) {
      const prefix = group.getAttribute("data-xm-group");
      const open = groupOpen(prefix, current);
      group.classList.toggle("is-open", open);
      const parent = group.querySelector(".xm-menu-parent");
      if (parent) {
        parent.setAttribute("aria-expanded", open ? "true" : "false");
      }
    });
  }

  function ensureReleasesCss() {
    if (document.querySelector('link[href*="releases.css"]')) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/releases.css?v=" + ASSET_VER;
    document.head.appendChild(link);
  }

  function loadModuleScript(href) {
    return new Promise(function (resolve) {
      if (window.XmModules && window.XmModules[href]) {
        resolve();
        return;
      }
      const id = MODULES[href];
      if (!id) {
        resolve();
        return;
      }
      const src = "/shared/modules/" + id + ".js?v=" + ASSET_VER;
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (window.XmModules && window.XmModules[href]) {
          resolve();
          return;
        }
        existing.addEventListener("load", function () {
          resolve();
        });
        existing.addEventListener("error", function () {
          resolve();
        });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = function () {
        resolve();
      };
      script.onerror = function () {
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  function mountRoute(href) {
    const key = normalize(href);
    if (key === "/" && document.getElementById("home-dashboard")) {
      return;
    }
    const root = contentRoot();
    if (!root) {
      return;
    }
    if (alreadyMounted(root, key)) {
      return;
    }
    const mod = window.XmModules && window.XmModules[key];
    if (!mod || typeof mod.mount !== "function") {
      return;
    }
    root.setAttribute("data-xm-mounted", key);
    if (key === "/releases") {
      root.setAttribute("data-xm-rel-mounted", "1");
    }
    window.__xmUnmount = mod.mount(root);
  }

  function bootCurrentModule() {
    if (current === "/" && document.getElementById("home-dashboard")) {
      return;
    }
    if (!MODULES[current]) {
      return;
    }
    if (current === "/releases") {
      ensureReleasesCss();
    }
    loadModuleScript(current).then(function () {
      mountRoute(current);
    });
  }

  function go(href, push) {
    const key = normalize(href);
    if (key === "/data") {
      window.location.replace("/data/overview");
      return;
    }
    if (key === "/shen") {
      window.location.replace("/shen/selection");
      return;
    }
    if (key === "/han") {
      window.location.replace("/han/selection");
      return;
    }
    if (key === "/" || !MODULES[key]) {
      window.location.assign(key);
      return;
    }
    if (push !== false) {
      history.pushState({ xm: key }, "", key);
    }
    paintActive(key);
    if (key === "/releases") {
      ensureReleasesCss();
    }
    const root = contentRoot();
    const prev = window.__xmUnmount;
    window.__xmUnmount = null;
    if (typeof prev === "function") {
      try {
        prev();
      } catch (_err) {
        /* keep going */
      }
    }
    if (root) {
      root.removeAttribute("data-xm-mounted");
      root.removeAttribute("data-xm-rel-mounted");
      root.innerHTML = "";
    }
    loadModuleScript(key).then(function () {
      mountRoute(key);
    });
    refreshQueueBadge();
  }

  function bindParents(scope) {
    const parents = scope.querySelectorAll(".xm-menu-parent");
    Array.prototype.forEach.call(parents, function (btn) {
      if (btn.dataset.navFast === "1") {
        return;
      }
      btn.dataset.navFast = "1";
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        const group = btn.closest(".xm-menu-group");
        if (!group) {
          return;
        }
        if (document.documentElement.classList.contains("xm-collapsed")) {
          try {
            localStorage.setItem("xm-sider-collapsed", "0");
          } catch (_err) {
            /* ignore */
          }
          applyCollapsed(false);
          group.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
          return;
        }
        const next = !group.classList.contains("is-open");
        group.classList.toggle("is-open", next);
        btn.setAttribute("aria-expanded", next ? "true" : "false");
      });
    });
  }

  function bindMenu(root) {
    const scope = root || document;
    bindParents(scope);
    const links = scope.querySelectorAll(".xm-menu a[href], a.xm-logo[href], a.xm-username[href]");
    Array.prototype.forEach.call(links, function (anchor) {
      if (anchor.dataset.navFast === "1") {
        return;
      }
      anchor.dataset.navFast = "1";
      const href = normalize(anchor.getAttribute("href"));
      anchor.addEventListener("click", function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) {
          return;
        }
        if (isActive(href)) {
          event.preventDefault();
          return;
        }
        if (href === "/" || !MODULES[href]) {
          return;
        }
        event.preventDefault();
        go(href);
      });
    });
  }

  function chinaDate() {
    return new Date().toLocaleDateString("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }

  function ensureUserTools() {
    const topbar = document.querySelector(".xm-topbar");
    if (!topbar) {
      return;
    }
    let user = topbar.querySelector(".xm-user");
    if (!user) {
      user = document.createElement("div");
      user.className = "xm-user";
      topbar.appendChild(user);
    }
    if (!document.getElementById("xm-date")) {
      const date = document.createElement("time");
      date.className = "xm-date";
      date.id = "xm-date";
      user.insertBefore(date, user.firstChild);
    }
    if (!document.getElementById("xm-refresh")) {
      const refresh = document.createElement("button");
      refresh.type = "button";
      refresh.className = "xm-refresh";
      refresh.id = "xm-refresh";
      refresh.textContent = "刷新";
      const dateEl = document.getElementById("xm-date");
      if (dateEl && dateEl.nextSibling) {
        user.insertBefore(refresh, dateEl.nextSibling);
      } else {
        user.insertBefore(refresh, user.firstChild ? user.firstChild.nextSibling : null);
      }
    }
    let name = document.getElementById("xm-username");
    if (!name) {
      name = document.createElement("a");
      name.id = "xm-username";
      name.className = "xm-username";
      name.href = "/me";
      name.textContent = "用户";
      user.appendChild(name);
    } else if (name.tagName !== "A") {
      const link = document.createElement("a");
      link.id = "xm-username";
      link.className = "xm-username";
      link.href = "/me";
      link.textContent = name.textContent || "用户";
      name.replaceWith(link);
    } else {
      name.href = "/me";
    }
  }

  function applyCollapsed(collapsed) {
    document.documentElement.classList.toggle("xm-collapsed", collapsed);
    const btn = document.getElementById("xm-collapse");
    if (btn) {
      btn.hidden = false;
      btn.textContent = collapsed ? "›" : "‹";
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.setAttribute("aria-label", collapsed ? "展开侧栏" : "折叠侧栏");
    }
  }

  function bindChrome(userLabel) {
    ensureUserTools();
    const nameEl = document.getElementById("xm-username");
    if (nameEl && userLabel) {
      nameEl.textContent = userLabel;
    }
    const dateEl = document.getElementById("xm-date");
    if (dateEl) {
      dateEl.dateTime = new Date().toISOString().slice(0, 10);
      dateEl.textContent = chinaDate();
    }
    const refreshBtn = document.getElementById("xm-refresh");
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = "1";
      refreshBtn.addEventListener("click", function () {
        window.location.reload();
      });
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
          window.location.replace("/login?out=1");
        });
      });
    }
    try {
      applyCollapsed(localStorage.getItem("xm-sider-collapsed") === "1");
    } catch (_err) {
      applyCollapsed(false);
    }
    bindMenu(document);
    startQueueWatch();
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
      '<div class="xm-tabs" aria-label="页签"><span class="xm-tab is-active">' +
      labelOf(current) +
      "</span></div>" +
      '<div class="xm-user">' +
      '<time class="xm-date" id="xm-date"></time>' +
      '<button type="button" class="xm-refresh" id="xm-refresh">刷新</button>' +
      '<a class="xm-username" id="xm-username" href="/me">用户</a>' +
      "</div></header>" +
      '<div class="xm-content" id="xm-content"></div></div>';

    if (existingSider) {
      shell.insertBefore(existingSider, shell.firstChild);
    } else {
      const sider = document.createElement("aside");
      sider.className = "xm-sider";
      sider.setAttribute("aria-label", "侧栏导航");
      sider.innerHTML = siderHtml();
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
    const boot = window.__xmBootUser;
    if (boot && (boot.displayName || boot.username)) {
      bindChrome(boot.displayName || boot.username);
    } else {
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
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootCurrentModule);
    } else {
      bootCurrentModule();
    }
  }

  window.addEventListener("popstate", function () {
    const href = normalize(window.location.pathname);
    if (href === "/") {
      window.location.replace("/data");
      return;
    }
    go(href, false);
  });

  paintNow();
})();
