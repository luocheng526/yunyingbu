/* Optional installed-app presentation. All business navigation stays in __xmGo. */
(function () {
  "use strict";
  if (window.__xmAppExperience) return;
  window.__xmAppExperience = true;
  var ASSET = "glass-20261123-1";
  var WINDOWS_APP = "https://github.com/luocheng526/yunyingbu/releases/download/desktop-v0.2.3/ZhenxuanFuture-0.2.3-win-x64.exe";
  var root = document.documentElement;
  var query = new URLSearchParams(location.search);
  var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  var installPrompt = null;
  var dialog = null;
  var lastFocus = null;
  var previousTheme = root.getAttribute("data-theme");
  var previousColorScheme = root.style.colorScheme;
  var previousThemeColor = document.querySelector('meta[name="theme-color"]')?.content || "#1677ff";
  var isLogin = !!document.querySelector("#login-form");
  var enabled = standalone || query.get("app") === "glass";
  // A normal website visit never inherits an App appearance preference.
  try {
    if (!isLogin && sessionStorage.getItem("xm-app-login") === "1") {
      var referrer = document.referrer ? new URL(document.referrer) : null;
      enabled = enabled || !!(referrer && referrer.origin === location.origin && referrer.searchParams.get("app") === "glass");
      sessionStorage.removeItem("xm-app-login");
    }
  } catch (_) {}
  if (isLogin) {
    document.querySelector("#login-form").addEventListener("submit", function () {
      try { if (enabled) sessionStorage.setItem("xm-app-login", "1"); else sessionStorage.removeItem("xm-app-login"); } catch (_) {}
    }, true);
    var note = document.createElement("p");
    note.className = "xg-login-note";
    note.textContent = "公司内部员工使用 · 请使用原网站账号登录";
    document.querySelector("#login-form").appendChild(note);
  }

  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "/shared/app/app-experience.css?v=" + ASSET;
  document.head.appendChild(css);

  function icon(name) {
    var paths = {
      home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
      data: '<path d="M5 20V11m7 9V4m7 16V8"/>',
      work: '<rect x="4" y="6" width="16" height="15" rx="3"/><path d="M9 6V3h6v3M8 12h8m-8 4h5"/>',
      me: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
      install: '<rect x="4" y="3" width="16" height="18" rx="4"/><path d="M12 7v9m-4-4 4 4 4-4"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>';
  }
  function makeButton(label, className) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    return button;
  }
  function setMode(on) {
    var wasEnabled = root.classList.contains("xm-glass");
    if (on && !wasEnabled) {
      previousTheme = root.getAttribute("data-theme");
      previousColorScheme = root.style.colorScheme;
      previousThemeColor = document.querySelector('meta[name="theme-color"]')?.content || "#1677ff";
    }
    enabled = on;
    root.classList.toggle("xm-glass", on);
    root.classList.toggle("xm-glass-login", on && isLogin);
    // The glass shell creates a stacking context; keep its drawer mask in that context.
    var mask = document.querySelector("#xm-phone-mask");
    var shell = document.querySelector(".xm-shell");
    if (mask && shell) (on ? shell : document.body).appendChild(mask);
    if (on) {
      root.setAttribute("data-theme", "light");
      root.style.colorScheme = "light";
    } else if (wasEnabled) {
      if (previousTheme === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", previousTheme);
      root.style.colorScheme = previousColorScheme;
    }
    var theme = document.querySelector('meta[name="theme-color"]');
    if (theme && (on || wasEnabled)) theme.content = on ? "#d8c8b5" : previousThemeColor;
    var url = new URL(location.href);
    if (on) url.searchParams.set("app", "glass");
    else url.searchParams.delete("app");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    updateHeading();
    updateNetwork();
  }

  // The public root manifest also remains available before login and to HR-only users.
  {
    var manifest = document.querySelector('link[rel="manifest"]') || document.createElement("link");
    manifest.rel = "manifest";
    manifest.crossOrigin = "use-credentials";
    manifest.href = "/manifest.webmanifest?v=" + ASSET;
    if (!manifest.parentNode) document.head.appendChild(manifest);
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    installPrompt = event;
    if (dialog && dialog.open) renderInstall();
  });
  window.addEventListener("appinstalled", function () {
    installPrompt = null;
    if (dialog && dialog.open) {
      dialog.querySelector(".xg-install-status").textContent = "安装完成，可以从桌面或应用列表打开星脉甄选。";
      var nativeButton = dialog.querySelector("[data-install-native]");
      if (nativeButton) nativeButton.hidden = true;
    }
  });

  function platform() {
    var ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
    if (/Android/.test(ua)) return "android";
    if (/Macintosh|Mac OS X/.test(ua)) return "mac";
    return "windows";
  }
  var platforms = {
    ios: { label: "iPhone / iPad", steps: ["使用 Safari 打开本网站并登录。", "点分享按钮，选择“添加到主屏幕”。", "如有“作为网页 App 打开”，将它开启，再点“添加”。"] },
    android: { label: "安卓", steps: ["使用 Chrome 或支持安装应用的浏览器打开本网站并登录。", "点“立即安装”；若未出现按钮，打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。", "安装后，从手机桌面打开星脉甄选。"] },
    mac: { label: "Mac", steps: ["在 macOS Sonoma 14 或更新版本中，用 Safari 打开本网站并登录。", "打开 Safari 的“文件”菜单或分享菜单，选择“添加到程序坞”。", "也可使用 Chrome / Edge 的安装应用功能。"] },
    windows: { label: "Windows", steps: ["点击下方“下载 Windows App”，保存到电脑。", "双击下载的 EXE 即可打开，使用原网站账号登录。", "可将左侧菜单拖入底部快捷栏，拖动排序，右键移除。Windows 11 22H2 及以上支持真实桌面玻璃效果。"] }
  };
  var selectedPlatform = platform();

  function renderInstall() {
    var body = dialog.querySelector(".xg-install-body");
    body.replaceChildren();
    var tabs = document.createElement("div");
    tabs.className = "xg-device-tabs";
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "选择安装设备");
    Object.keys(platforms).forEach(function (key) {
      var b = makeButton(platforms[key].label, "xg-device-tab");
      b.setAttribute("aria-pressed", String(selectedPlatform === key));
      b.addEventListener("click", function () { selectedPlatform = key; renderInstall(); });
      tabs.appendChild(b);
    });
    body.appendChild(tabs);
    var list = document.createElement("ol");
    list.className = "xg-install-steps";
    platforms[selectedPlatform].steps.forEach(function (text) {
      var li = document.createElement("li"); li.textContent = text; list.appendChild(li);
    });
    body.appendChild(list);
    var status = document.createElement("p");
    status.className = "xg-install-status";
    status.setAttribute("role", "status");
    status.textContent = selectedPlatform === "windows" ? "Windows 独立版 · 免安装 · 与网站共用账号、权限和数据，使用时需要联网。" : (isLogin ? "请先使用原网站账号登录，再完成安装。" : "当前提供网页版 App，与网站共用账号、权限和数据。业务操作需要联网。");
    body.appendChild(status);
    var actions = document.createElement("div");
    actions.className = "xg-install-actions";
    if (selectedPlatform === "windows") {
      var download = document.createElement("a");
      download.className = "xg-button xg-button-primary";
      download.href = WINDOWS_APP;
      download.target = "_blank";
      download.rel = "noopener noreferrer";
      download.textContent = "下载 Windows App";
      download.style.textDecoration = "none";
      actions.appendChild(download);
    }
    if (installPrompt && !isLogin && selectedPlatform === platform() && selectedPlatform !== "windows") {
      var install = makeButton("立即安装", "xg-button xg-button-primary");
      install.dataset.installNative = "1";
      install.addEventListener("click", async function () {
        var pending = installPrompt;
        if (!pending) return;
        installPrompt = null;
        install.disabled = true;
        try {
          await pending.prompt();
          var choice = await pending.userChoice;
          status.textContent = choice.outcome === "accepted" ? "已接受安装，请在桌面或应用列表查看。" : "已取消安装，仍可按上方步骤安装。";
        } catch (_) { status.textContent = "请使用浏览器菜单中的安装入口。"; }
        install.hidden = true;
      });
      actions.appendChild(install);
    }
    var preview = makeButton(selectedPlatform === "windows" ? "预览网页版界面" : (enabled ? "进入 App 界面" : "体验 App 界面"), selectedPlatform === "windows" ? "xg-button" : "xg-button xg-button-primary");
    preview.addEventListener("click", function () { setMode(true); dialog.close(); if (isLogin) document.querySelector("#username")?.focus(); });
    actions.appendChild(preview);
    if (enabled && !standalone) {
      var restore = makeButton("返回原网页外观", "xg-button");
      restore.addEventListener("click", function () { setMode(false); dialog.close(); });
      actions.appendChild(restore);
    }
    body.appendChild(actions);
    var copy = makeButton("复制安装链接", "xg-copy-link");
    copy.addEventListener("click", async function () {
      var url = location.origin + "/home?install=1";
      try { await navigator.clipboard.writeText(url); copy.textContent = "安装链接已复制"; }
      catch (_) { status.textContent = "安装链接：" + url; }
    });
    body.appendChild(copy);
  }
  function openInstall() {
    lastFocus = document.activeElement;
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "xg-install-dialog";
      dialog.setAttribute("aria-labelledby", "xg-install-title");
      dialog.innerHTML = '<button class="xg-dialog-close" type="button" aria-label="关闭安装说明">×</button><div class="xg-app-mark"><img src="/apple-touch-icon.png" alt="" width="56" height="56"></div><p class="xg-eyebrow">YOUR WORKSPACE, EVERYWHERE</p><h2 id="xg-install-title">把星脉甄选，放到桌面。</h2><p class="xg-install-lead">熟悉的工作，一个更轻盈的入口。</p><div class="xg-install-body"></div>';
      document.body.appendChild(dialog);
      dialog.querySelector(".xg-dialog-close").addEventListener("click", function () { dialog.close(); });
      dialog.addEventListener("close", function () { if (lastFocus?.isConnected) lastFocus.focus(); });
      dialog.addEventListener("click", function (event) {
        if (event.target !== dialog) return;
        var rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      });
    }
    renderInstall();
    if (!dialog.open) dialog.showModal();
  }
  window.XmAppExperience = { openInstall: openInstall, setMode: setMode };
  var entry = makeButton("安装 App", "xg-install-entry");
  entry.setAttribute("aria-label", "安装 App");
  entry.innerHTML = icon("install") + "<span>安装 App</span>";
  entry.addEventListener("click", openInstall);
  var tools = document.querySelector(".xm-user");
  if (tools) tools.insertBefore(entry, tools.firstChild);
  else { entry.classList.add("xg-login-install"); document.body.appendChild(entry); }

  var heading = null;
  var dock = null;
  if (!isLogin && document.querySelector(".xm-workspace")) {
    heading = document.createElement("header");
    heading.className = "xg-heading";
    heading.innerHTML = '<div><p class="xg-eyebrow">ZHENXUAN · WORKSPACE</p><h1>工作台</h1><p class="xg-subtitle">让每一份努力，都有清晰的方向。</p></div><div class="xg-today"></div>';
    var workspace = document.querySelector(".xm-workspace");
    workspace.parentNode.insertBefore(heading, workspace);
    heading.querySelector(".xg-today").textContent = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "long", day: "numeric", weekday: "long" }).format(new Date());
    dock = document.createElement("nav");
    dock.className = "xg-dock";
    dock.setAttribute("aria-label", "App 快捷导航");
    document.body.appendChild(dock);
  }
  function visibleLink(href) {
    return Array.from(document.querySelectorAll('.xm-menu a[href]')).find(function (a) {
      if (a.getAttribute("href") !== href || a.closest("[hidden]") || getComputedStyle(a).display === "none") return false;
      for (var parent = a.parentElement; parent && !parent.classList.contains("xm-sider"); parent = parent.parentElement) {
        if (parent.style.display === "none") return false;
      }
      return true;
    });
  }
  function syncDock() {
    if (!dock) return;
    var items = [
      { href: "/home", name: "首页", icon: "home" },
      { href: "/data/overview", name: "数据", icon: "data" },
      { href: "/work", name: "工作", icon: "work" },
      { href: "/me", name: "我的", icon: "me" }
    ].filter(function (item) { return visibleLink(item.href); });
    var signature = items.map(function (item) { return item.href; }).join("|");
    if (dock.dataset.items !== signature) {
      dock.dataset.items = signature;
      dock.replaceChildren();
      items.forEach(function (item) {
        var b = makeButton(item.name, "xg-dock-item");
        b.innerHTML = icon(item.icon) + "<span>" + item.name + "</span>";
        b.dataset.href = item.href;
        b.addEventListener("click", function () { if (visibleLink(item.href) && window.__xmGo) { window.__xmGo(item.href); updateHeading(); } });
        dock.appendChild(b);
      });
      var all = makeButton("全部", "xg-dock-item");
      all.innerHTML = icon("grid") + "<span>全部</span>";
      all.addEventListener("click", function () {
        if (matchMedia("(max-width: 880px)").matches) document.querySelector("#xm-phone-menu")?.click();
        else { if (root.classList.contains("xm-collapsed")) document.querySelector(".xm-collapse")?.click(); document.querySelector(".xm-menu a")?.focus(); }
      });
      dock.appendChild(all);
    }
    Array.from(dock.querySelectorAll("[data-href]")).forEach(function (b) {
      var active = location.pathname === b.dataset.href || (b.dataset.href === "/data/overview" && location.pathname.startsWith("/data"));
      b.setAttribute("aria-current", active ? "page" : "false");
    });
  }
  function updateHeading() {
    if (enabled && !standalone) {
      var currentUrl = new URL(location.href);
      if (currentUrl.searchParams.get("app") !== "glass") {
        currentUrl.searchParams.set("app", "glass");
        history.replaceState(history.state, "", currentUrl.pathname + currentUrl.search + currentUrl.hash);
      }
    }
    if (heading) {
      var active = document.querySelector(".xm-tab.is-active .xm-tab-label") || document.querySelector(".xm-menu a.is-active span");
      var title = active?.textContent.trim() || "工作台";
      heading.querySelector("h1").textContent = title === "首页" ? "经营总览" : title;
    }
    syncDock();
  }
  if (dock) {
    var scheduled = false;
    function scheduleUpdate() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () { scheduled = false; updateHeading(); });
    }
    var sider = document.querySelector(".xm-sider");
    if (sider) new MutationObserver(scheduleUpdate).observe(sider, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "style"] });
    window.addEventListener("popstate", function () {
      setMode(standalone || new URL(location.href).searchParams.get("app") === "glass");
      scheduleUpdate();
    });
    document.addEventListener("click", scheduleUpdate);
  }
  var offline = document.createElement("div");
  offline.className = "xg-offline";
  offline.setAttribute("role", "status");
  offline.textContent = "网络已断开。请恢复连接后再提交或刷新数据。";
  document.body.appendChild(offline);
  function updateNetwork() { offline.hidden = !enabled || navigator.onLine; }
  window.addEventListener("online", updateNetwork);
  window.addEventListener("offline", updateNetwork);
  updateNetwork();
  setMode(enabled);
  if (query.get("install") === "1") {
    try { sessionStorage.setItem("xm-install-pending", "1"); } catch (_) {}
    openInstall();
  } else if (!isLogin) {
    try { if (sessionStorage.getItem("xm-install-pending") === "1") { sessionStorage.removeItem("xm-install-pending"); openInstall(); } } catch (_) {}
  }
})();
