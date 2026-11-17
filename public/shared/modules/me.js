/* xm-module-me profile-workbench-xm-ui */
(function () {
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function hashName(name) {
    let h = 2166136261;
    const text = String(name || "脉");
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function virtualAvatar(name) {
    const h = hashName(name);
    const skins = ["#f3c7a8", "#e8b894", "#f6d0b1", "#d4a574", "#c68642"];
    const hairs = ["#1a1a1a", "#111827", "#2c1810", "#374151"];
    const suits = ["#1e3a5f", "#1d4ed8", "#1e40af", "#0f172a", "#1e293b"];
    const bgs = ["#dbeafe", "#e0f2fe", "#eef2ff", "#f0f9ff"];
    const skin = skins[h % skins.length];
    const hair = hairs[(h >> 4) % hairs.length];
    const suit = suits[(h >> 8) % suits.length];
    const bg = bgs[(h >> 12) % bgs.length];
    const longHair = h % 5 === 0;
    const hairBack = longHair
      ? '<path d="M18 36c1-18 10-26 22-26s21 8 22 26v28H18z" fill="' + hair + '"/>'
      : '<path d="M20 38c2-20 12-26 20-26s18 6 20 26v6H20z" fill="' + hair + '"/>';
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">' +
      '<defs><clipPath id="xmav"><circle cx="80" cy="80" r="80"/></clipPath></defs>' +
      '<g clip-path="url(#xmav)">' +
      '<rect width="160" height="160" fill="' + bg + '"/>' +
      '<ellipse cx="80" cy="178" rx="70" ry="48" fill="' + suit + '"/>' +
      '<path d="M48 128c8-16 18-22 32-22s24 6 32 22v40H48z" fill="#f8fafc"/>' +
      hairBack +
      '<ellipse cx="48" cy="86" rx="8" ry="11" fill="' + skin + '"/>' +
      '<ellipse cx="112" cy="86" rx="8" ry="11" fill="' + skin + '"/>' +
      '<circle cx="80" cy="82" r="32" fill="' + skin + '"/>' +
      '<path d="M50 70c8-18 20-24 30-24s22 6 30 24c-8-10-18-14-30-14s-22 4-30 14z" fill="' + hair + '"/>' +
      '<rect x="58" y="68" width="12" height="3.2" rx="1.4" fill="#1f2937"/>' +
      '<rect x="90" y="68" width="12" height="3.2" rx="1.4" fill="#1f2937"/>' +
      '<ellipse cx="66" cy="80" rx="4.2" ry="5" fill="#1f2937"/>' +
      '<ellipse cx="94" cy="80" rx="4.2" ry="5" fill="#1f2937"/>' +
      '<circle cx="67.4" cy="78.6" r="1.2" fill="#fff"/>' +
      '<circle cx="95.4" cy="78.6" r="1.2" fill="#fff"/>' +
      '<path d="M80 84v8" stroke="#c0846a" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path d="M72 98c5 5 11 5 16 0" fill="none" stroke="#c0846a" stroke-width="2" stroke-linecap="round"/>' +
      "</g></svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function ico(d, c, s) {
    const size = s || 22;
    return (
      '<svg viewBox="0 0 24 24" width="' +
      size +
      '" height="' +
      size +
      '" fill="none" stroke="' +
      (c || "currentColor") +
      '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      d +
      "</svg>"
    );
  }

  function ensureCss() {
    let css = document.getElementById("xm-me-page-css");
    if (!css) {
      css = document.createElement("style");
      css.id = "xm-me-page-css";
      document.head.appendChild(css);
    }
    css.textContent =
      "#xm-content:has(.me-page){overflow:hidden!important;height:calc(100dvh - 86px);max-height:calc(100dvh - 86px);}" +
      "#xm-content .me-page,.me-page.xm-ui-scope{padding:4px 8px 8px!important;margin:0!important;max-width:none!important;display:flex;flex-direction:column;height:100%;max-height:100%;overflow:hidden;min-height:0;background:transparent;}" +
      ".me-page.xm-ui-scope .xm-ui-page-header{margin-bottom:10px;flex:0 0 auto;align-items:flex-start;}" +
      ".me-page.xm-ui-scope .xm-ui-page-title{font-size:24px;}" +
      ".me-page.xm-ui-scope .xm-ui-stat-grid{flex:0 0 auto;grid-template-columns:repeat(4,minmax(0,1fr));margin:0 0 8px;gap:10px;}" +
      ".me-page.xm-ui-scope .xm-ui-stat-grid .xm-ui-stat-card{min-height:64px;padding:10px 12px;}" +
      ".me-page.xm-ui-scope .xm-ui-stat-grid .xm-ui-stat-card__value{font-size:20px;}" +
      ".me-page.xm-ui-scope .xm-ui-section-title{min-height:40px;padding:8px 16px 8px 20px;}" +
      ".me-page.xm-ui-scope .xm-ui-stat-card{min-height:72px;padding:12px 16px;}" +
      ".me-page.xm-ui-scope .xm-ui-stat-card__value{font-size:22px;}" +
      ".me-page.xm-ui-scope .xm-ui-button{height:auto!important;min-height:34px!important;}" +
      ".me-page.xm-ui-scope img{max-width:none!important;}" +
      ".me-page.xm-ui-scope svg{max-width:none!important;}" +
      ".me-banner{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px;flex:0 0 auto;align-items:stretch;}" +
      ".me-banner .xm-ui-card,.me-banner .xm-ui-stat-card{height:100%;}" +
      ".me-banner .xm-ui-stat-card{flex-wrap:wrap;min-height:108px;}" +
      ".me-banner .me-safe-bar{flex:1 0 100%;}" +
      ".me-banner .xm-ui-card.me-profile{overflow:hidden;border-color:#d7e8ff;background:#eaf3ff url(\"data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 120" fill="none"><path d="M280 120H0V78c28-10 48-28 78-28 22 0 32 14 50 14 24 0 36-26 64-26 26 0 38 22 58 22 34 0 46-40 30-60" fill="#cfe4ff" opacity=".55"/><rect x="168" y="42" width="22" height="62" rx="3" fill="#93c5fd"/><rect x="194" y="28" width="28" height="76" rx="3" fill="#60a5fa"/><rect x="226" y="48" width="20" height="56" rx="3" fill="#93c5fd"/><rect x="248" y="38" width="18" height="66" rx="3" fill="#7dd3fc"/></svg>'
      ) +
      "\") no-repeat right 8px bottom;background-size:180px 96px,auto;}" +
      ".me-banner .me-profile .xm-ui-card__body{display:flex;align-items:center;gap:16px;padding:14px 18px!important;}" +
      ".me-avatar{position:relative;display:block;width:84px;height:84px;flex:0 0 84px;cursor:pointer;margin:0!important;overflow:visible;}" +
      ".me-avatar img{width:84px!important;height:84px!important;border-radius:50%;object-fit:cover;border:3px solid #fff;display:block;background:#dbeafe;}" +
      ".me-page input.me-file,.me-page #who-avatar-file{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;border:0!important;opacity:0!important;}" +
      ".me-avatar-cam{position:absolute;right:0;bottom:0;width:22px;height:22px;border-radius:50%;background:var(--xm-ui-primary,#1677ff);color:#fff;display:grid;place-items:center;border:2px solid #fff;}" +
      ".me-who{min-width:0;flex:1;}" +
      ".me-who h2{margin:0;font-size:22px;display:inline;}" +
      ".me-role{display:inline-flex;margin-left:8px;padding:2px 10px;border-radius:999px;background:var(--xm-ui-primary-soft,#eaf3ff);color:var(--xm-ui-primary,#1677ff);font-size:12px;font-weight:700;}" +
      ".me-meta{margin:6px 0 4px;color:var(--xm-ui-text-secondary,#52617a);font-size:13px;}" +
      ".me-bio{margin:0;color:var(--xm-ui-text-secondary,#52617a);font-size:13px;}" +
      ".me-safe-bar{margin:0 18px 14px;height:8px;border-radius:99px;background:#e5e7eb;overflow:hidden;}" +
      ".me-safe-bar span{display:block;height:100%;width:86%;background:linear-gradient(90deg,#4ade80,#22c55e);}" +
      ".me-page .xm-ui-filter-toolbar{flex:0 0 auto;margin-bottom:8px;padding:8px 10px;}" +
      ".me-split{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1fr) minmax(0,1.25fr);gap:10px;align-items:stretch;flex:1;min-height:0;overflow:hidden;}" +
      ".me-col{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;}" +
      ".me-col > .xm-ui-card{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;}" +
      ".me-col > .xm-ui-card:has(.me-actions){flex:0 0 auto;}" +
      ".me-col > .xm-ui-card + .xm-ui-card{margin-top:10px;}" +
      ".me-col > .xm-ui-card .xm-ui-card__body{flex:1;display:flex;flex-direction:column;min-height:0;padding:8px 16px 12px!important;}" +
      "#me-security-card .xm-ui-card__body{gap:6px;}" +
      "#password-form{display:flex;flex-direction:column;gap:2px;}" +
      ".me-sec-actions{margin-top:auto;padding-top:8px;display:flex;flex-direction:column;gap:8px;}" +
      ".me-sec-actions form{margin:0;}" +
      ".me-sec-actions .xm-ui-button{width:100%;}" +
      ".me-kv{flex:1;}" +
      ".me-kv div{display:grid;grid-template-columns:76px minmax(0,1fr);gap:8px;padding:6px 0;border-top:1px solid var(--xm-ui-border,#e4ebf5);font-size:13px;align-items:center;}" +
      ".me-kv div:first-child{border-top:0;}" +
      ".me-kv em{font-style:normal;color:var(--xm-ui-text-secondary,#52617a);}" +
      ".me-kv strong{font-weight:700;display:inline-flex;align-items:center;gap:6px;}" +
      ".me-ico-btn{border:0!important;background:transparent!important;color:#8b98ad!important;cursor:pointer;padding:0!important;display:inline-flex;height:auto!important;}" +
      ".me-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}" +
      ".me-actions .xm-ui-button{width:100%;padding:10px 4px 8px!important;min-height:64px!important;flex-direction:column;gap:6px;border-color:transparent!important;background:var(--xm-ui-surface-soft,#f7f9fc)!important;color:var(--xm-ui-text,#17233d)!important;box-shadow:none!important;}" +
      ".me-actions .xm-ui-button span{font-size:12px;font-weight:700;}" +
      ".me-perm-box{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:12px;background:var(--xm-ui-primary-soft,#eaf3ff);}" +
      ".me-perm-box strong{display:block;margin-bottom:4px;}" +
      ".me-perm-box p{margin:0;color:var(--xm-ui-text-secondary,#52617a);font-size:12px;}" +
      ".me-dev{display:grid;grid-template-columns:minmax(0,1.2fr) auto auto auto;gap:8px;align-items:center;padding:8px 0;border-top:1px solid var(--xm-ui-border,#e4ebf5);font-size:12px;}" +
      ".me-dev:first-child{border-top:0;}" +
      ".me-dev-n{display:inline-flex;align-items:center;gap:8px;font-weight:700;flex-wrap:wrap;}" +
      ".me-city,.me-time{color:var(--xm-ui-text-muted,#8b98ad);white-space:nowrap;}" +
      ".me-page input:not([type=file]){display:block;width:100%;margin:0 0 8px;padding:8px 12px;border:1px solid var(--xm-ui-border-strong,#d7e2f0);border-radius:8px;font:inherit;font-size:13px;background:#fff;box-sizing:border-box;}" +
      ".me-page .status{min-height:0;margin:0 0 4px;font-size:13px;}" +
      ".me-page .status.error{color:var(--xm-ui-red,#e5484d);}" +
      ".me-page .status.ok{color:var(--xm-ui-green,#12b76a);}" +
      ".me-group{margin-top:10px;}" +
      ".me-group h3{margin:0 0 6px;font-size:14px;}" +
      ".me-tags{display:flex;flex-wrap:wrap;gap:6px;}" +
      ".me-pane{display:none;}" +
      ".me-pane.on{display:block;flex:1;min-height:0;overflow:auto;}" +
      ".me-pane.on[data-me-pane=basic]{display:flex;flex-direction:column;overflow:hidden;}" +
      ".me-pane.on[data-me-pane=rights]{display:flex;flex-direction:column;overflow:hidden;}" +
      ".me-perm-work{display:grid;grid-template-columns:220px minmax(0,1.4fr) 280px;gap:12px;flex:1;min-height:0;}" +
      ".me-perm-work > .xm-ui-card,.me-perm-center,.me-perm-rail{min-height:0;overflow:auto;}" +
      ".me-perm-center,.me-perm-rail{display:flex;flex-direction:column;gap:10px;min-height:0;overflow:hidden;}" +
      ".me-perm-center > .xm-ui-card,.me-perm-rail > .xm-ui-card{flex:1;min-height:0;overflow:auto;}" +
      ".me-dir-item{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:0;background:transparent;border-radius:10px;text-align:left;cursor:pointer;font:inherit;color:inherit;}" +
      ".me-dir-item.is-on{background:var(--xm-ui-primary-soft,#eaf3ff);color:var(--xm-ui-primary,#1677ff);}" +
      ".me-dir-item b{flex:1;font-size:13px;}" +
      ".me-dir-av{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:#eef2ff;color:#4f46e5;font-size:12px;font-weight:800;flex:0 0 28px;}" +
      ".me-perm-split{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:16px;}" +
      ".me-check{display:flex;align-items:center;gap:8px;padding:7px 0;font-size:13px;}" +
      ".me-check input{width:16px;height:16px;margin:0;}" +
      ".me-tree-item{padding:8px 0;border-bottom:1px solid var(--xm-ui-border,#e4ebf5);display:flex;align-items:center;gap:8px;font-size:13px;}" +
      ".me-picked{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--xm-ui-border,#e4ebf5);font-size:13px;}" +
      ".me-q4{display:grid;grid-template-columns:1fr 1fr;gap:8px;}" +
      ".me-q4 .xm-ui-button{flex-direction:column;align-items:flex-start;min-height:72px!important;height:auto!important;padding:10px!important;white-space:normal;text-align:left;}" +
      ".me-note{margin:0;color:var(--xm-ui-text-secondary,#52617a);font-size:12px;line-height:1.7;}" +
      ".me-page.xm-ui-scope .xm-ui-table th,.me-page.xm-ui-scope .xm-ui-table td{height:32px;padding:0 8px;font-size:12px;}" +
      "#device-list,.me-col > .xm-ui-card:has(#device-list) .xm-ui-card__body{overflow:auto;}" +
      "@media (max-width:900px){.me-banner,.me-split,.me-actions{grid-template-columns:1fr;}.me-page{height:auto;max-height:none;overflow:auto;}}";
  }

  function maskPhone(phone) {
    const raw = String(phone || "").replace(/\D/g, "");
    if (raw.length >= 7) {
      return raw.slice(0, 3) + "****" + raw.slice(-4);
    }
    return phone || "—";
  }

  function tenure(createdAt, frozen) {
    if (frozen) {
      return frozen;
    }
    const text = String(createdAt || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return createdAt || "—";
    }
    const start = new Date(text + "T00:00:00");
    const now = new Date();
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (months < 0) {
      months = 0;
    }
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const extra = years ? "（" + years + "年" + (rest ? rest + "个月" : "") + "）" : rest ? "（" + rest + "个月）" : "";
    return text + extra;
  }

  function withAttr(html, extra) {
    return String(html).replace("<button ", "<button " + extra + " ");
  }

  const CAM =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" stroke-width="2"><path d="M4 8h3l2-2h6l2 2h3v10H4z"/><circle cx="12" cy="13" r="3"/></svg>';

  window.XmModules = window.XmModules || {};
  window.XmModules["/me"] = {
    mount: function (root) {
      ensureCss();
      const UI = window.XmUI;
      if (!UI) {
        root.innerHTML = '<div class="me-page xm-ui-scope">个人中心需要 window.XmUI</div>';
        return function () {
          root.innerHTML = "";
        };
      }

      const saveBtn = withAttr(UI.button({ label: "保存新密码", type: "submit" }), 'form="password-form"');
      const logoutBtn = UI.button({ label: "退出登录", type: "submit", variant: "secondary" }).replace(
        "xm-ui-button--secondary",
        "xm-ui-button--secondary me-btn-logout"
      );
      const hardBtn = withAttr(
        UI.button({ label: "强制刷新", type: "button", variant: "secondary" }),
        'id="me-hard-reload" title="绕过缓存重新加载本页"'
      );

      function quick(label, extra, iconPath, color) {
        return withAttr(UI.button({ label: label, variant: "secondary", size: "small" }), extra).replace(
          ">" + label,
          ">" + ico(iconPath, color || "#1677ff", 22) + "<span>" + label + "</span>"
        );
      }

      const tabs = UI.FilterToolbar({
        search: false,
        tabs: [
          { label: "基本信息", value: "basic", active: true },
          { label: "账号安全", value: "security" },
          { label: "消息通知", value: "notice" },
          { label: "我的权限", value: "rights" },
          { label: "登录设备管理", value: "devices" },
          { label: "操作日志", value: "logs" }
        ]
      })
        .replace(/data-xm-ui-tab="/g, 'data-me-tab="')
        .replace('class="xm-ui-filter-toolbar"', 'class="xm-ui-filter-toolbar" id="me-tabs"');

      const profileCard = UI.ContentCard({
        className: "me-profile",
        content:
          '<label class="me-avatar" id="who-avatar" title="点击上传头像" for="who-avatar-file">' +
          '<img id="who-avatar-img" alt="" src="' +
          virtualAvatar("脉") +
          '" />' +
          '<span class="me-avatar-cam">' +
          CAM +
          "</span></label>" +
          '<input class="me-file" id="who-avatar-file" type="file" accept="image/*" />' +
          '<div class="me-who"><h2 id="who-name">—</h2> ' +
          '<span class="me-role" id="who-role"></span>' +
          '<p class="me-meta">工号：<b id="who-no"></b><span>　|　</span>所属部门：<b id="who-dept-top"></b></p>' +
          '<p class="me-bio" id="who-bio"></p></div>'
      });

      const safeCard = UI.StatCard({
        icon: "check",
        tone: "green",
        label: "账号安全",
        value: "安全等级：高",
        note: "已开启：登录密码、手机验证、操作日志"
      })
        .replace("<article ", '<article data-go="security" ')
        .replace("</article>", '<div class="me-safe-bar"><span></span></div></article>');

      const securityCard = UI.ContentCard({
        title: "账号安全",
        content:
          '<p id="status" class="status" role="status"></p>' +
          '<form id="password-form" autocomplete="off">' +
          '<input id="current-password" type="password" required placeholder="当前密码" />' +
          '<input id="new-password" type="password" required minlength="8" placeholder="新密码（至少 8 位）" />' +
          '<input id="confirm-password" type="password" required minlength="8" placeholder="再次输入新密码" />' +
          "</form>" +
          '<div class="me-sec-actions">' +
          saveBtn +
          '<form id="logout-form">' +
          logoutBtn +
          "</form>" +
          hardBtn +
          "</div>"
      }).replace("<section ", '<section id="me-security-card" ');

      const whoCard = UI.ContentCard({
        title: "个人信息",
        action: "编辑信息",
        content:
          '<div class="me-kv" id="who-view">' +
          '<div><em>姓名</em><strong id="who-name-2"></strong></div>' +
          '<div><em>工号</em><strong id="who-no-2"></strong></div>' +
          '<div><em>部门</em><strong id="who-dept"></strong></div>' +
          '<div><em>岗位</em><strong id="who-title"></strong></div>' +
          '<div><em>入职日期</em><strong id="who-created"></strong></div>' +
          '<div><em>联系方式</em><strong><span id="who-phone"></span> <button class="me-ico-btn" type="button" id="toggle-phone" title="显示">' +
          UI.icon("search") +
          "</button></strong></div>" +
          '<div><em>邮箱</em><strong><span id="who-email"></span> <button class="me-ico-btn" type="button" id="copy-email" title="复制">' +
          UI.icon("file") +
          "</button></strong></div>" +
          '<div><em>汇报对象</em><strong id="who-manager"></strong></div></div>' +
          '<form id="who-form" hidden><p id="who-status" class="status"></p>' +
          '<input id="edit-name" placeholder="姓名" />' +
          '<input id="edit-phone" placeholder="联系方式" />' +
          '<input id="edit-email" placeholder="邮箱" />' +
          UI.button({ label: "保存信息", type: "submit" }) +
          "</form>" +
          '<span id="who-username" hidden></span>'
      }).replace('class="xm-ui-text-action"', 'class="xm-ui-text-action" id="who-edit"');

      const quickCard = UI.ContentCard({
        title: "快捷操作",
        content:
          '<div class="me-actions">' +
          quick("修改密码", 'data-go="security"', '<path d="M8 11V8a4 4 0 1 1 8 0v3M6 11h12v9H6z"/>', "#1677ff") +
          quick("绑定手机", 'data-soon="绑定手机"', '<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M11 18h2"/>', "#0ea5e9") +
          quick("修改邮箱", 'id="go-email"', '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="m4 8 8 6 8-6"/>', "#1677ff") +
          quick("头像设置", 'id="go-avatar"', '<circle cx="12" cy="8" r="3"/><path d="M5 19c.8-3 3.4-5 7-5s6.2 2 7 5"/>', "#6366f1") +
          quick("通知设置", 'data-soon="通知设置"', '<path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/>', "#ef4444") +
          quick("界面偏好", 'data-soon="界面偏好"', '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>', "#1677ff") +
          quick("语言设置", 'data-soon="语言设置"', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>', "#0d9488") +
          quick("二次验证", 'data-soon="二次验证"', '<path d="M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>', "#1677ff") +
          "</div>"
      });

      const permCard = UI.ContentCard({
        title: "我的权限",
        action: "查看详情",
        content:
          '<div class="me-perm-box"><span class="xm-ui-stat-card__icon xm-ui-tone--blue">' +
          UI.icon("award") +
          '</span><div><strong id="perm-name">运营管理权限组</strong><p id="perm-desc"></p></div></div>'
      }).replace('class="xm-ui-text-action"', 'class="xm-ui-text-action" data-go="rights"');

      const deviceCard = UI.ContentCard({
        title: "登录与设备",
        action: "查看全部",
        content: '<div id="device-list"></div>'
      }).replace('class="xm-ui-text-action"', 'class="xm-ui-text-action" data-go="devices"');

      root.innerHTML =
        '<div class="me-page xm-ui-scope">' +
        UI.PageContentHeader({
          title: "个人中心",
          description: "管理个人信息、账号安全、偏好设置与系统授权。责权按本人账号展示，不改他人权限。"
        }) +
        '<div class="xm-ui-stat-grid" id="me-stats">' +
        UI.StatCard({ icon: "users", tone: "blue", label: "已授权模块", value: "0" }).replace(
          'xm-ui-stat-card__value">',
          'xm-ui-stat-card__value" id="me-stat-mod">'
        ) +
        UI.StatCard({ icon: "check", tone: "green", label: "已授权功能", value: "0" }).replace(
          'xm-ui-stat-card__value">',
          'xm-ui-stat-card__value" id="me-stat-on">'
        ) +
        UI.StatCard({ icon: "close", tone: "orange", label: "未授权", value: "0" }).replace(
          'xm-ui-stat-card__value">',
          'xm-ui-stat-card__value" id="me-stat-off">'
        ) +
        UI.StatCard({ icon: "award", tone: "purple", label: "范围", value: "仅本人" }).replace(
          'xm-ui-stat-card__value">',
          'xm-ui-stat-card__value" id="me-stat-scope">'
        ) +
        "</div>" +
        '<div class="me-banner">' +
        profileCard +
        safeCard +
        "</div>" +
        tabs +
        '<div class="me-pane on" data-me-pane="basic"><div class="me-split">' +
        '<div class="me-col">' +
        securityCard +
        "</div>" +
        '<div class="me-col">' +
        whoCard +
        "</div>" +
        '<div class="me-col">' +
        quickCard +
        permCard +
        deviceCard +
        "</div></div></div>" +
        '<div class="me-pane" data-me-pane="notice">' +
        UI.ContentCard({
          content: UI.EmptyState({ title: "消息通知设置即将开放", description: "该能力即将上线" }).replace(
            'class="xm-ui-empty-state"',
            'class="xm-ui-empty-state me-empty"'
          )
        }) +
        "</div>" +
        '<div class="me-pane" data-me-pane="rights">' +
        '<div class="me-perm-work">' +
        UI.ContentCard({
          title: "权限目录",
          description: "我的责权清单",
          content: '<div id="perm-dir"></div>'
        }) +
        '<div class="me-perm-center">' +
        UI.FilterToolbar({
          search: false,
          tabs: [
            { label: "功能权限", value: "func", active: true },
            { label: "数据权限", value: "data" },
            { label: "操作权限", value: "ops" },
            { label: "权限模板", value: "tpl" }
          ]
        }).replace('class="xm-ui-filter-toolbar"', 'class="xm-ui-filter-toolbar" id="perm-subtabs"') +
        UI.ContentCard({
          title: "模块权限配置",
          description: "查看当前账号可访问的系统模块及功能",
          content:
            '<div class="me-perm-func"><div class="me-perm-split"><div id="duties"></div><div id="perm-features"></div></div></div>' +
            '<div class="me-perm-sub" data-perm-sub="data" hidden>' +
            UI.EmptyState({ title: "数据权限", description: "个人中心按责权清单展示功能授权，数据范围以各业务模块为准。" }) +
            "</div>" +
            '<div class="me-perm-sub" data-perm-sub="ops" hidden>' +
            UI.EmptyState({ title: "操作权限", description: "操作类授权已合并在功能权限中。" }) +
            "</div>" +
            '<div class="me-perm-sub" data-perm-sub="tpl" hidden>' +
            UI.EmptyState({ title: "权限模板", description: "模板配置不在个人中心，这里只读本人已授权项。" }) +
            "</div>"
        }) +
        "</div>" +
        '<div class="me-perm-rail">' +
        UI.ContentCard({
          title: "已选权限",
          content: '<p class="me-note">共 <span id="perm-picked-count">0</span> 项</p><div id="perm-picked"></div>'
        }) +
        UI.ContentCard({
          title: "快捷操作",
          content:
            '<div class="me-q4">' +
            quick("修改密码", 'data-go="security"', '<path d="M8 11V8a4 4 0 1 1 8 0v3M6 11h12v9H6z"/>', "#1677ff") +
            quick("头像设置", 'id="go-avatar-2"', '<circle cx="12" cy="8" r="3"/><path d="M5 19c.8-3 3.4-5 7-5s6.2 2 7 5"/>', "#7a5af8") +
            quick("退出登录", 'data-go="security"', '<path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9"/>', "#e5484d") +
            quick("强制刷新", 'id="me-hard-reload-2"', '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>', "#1677ff") +
            "</div>"
        }) +
        UI.ContentCard({
          title: "权限说明",
          content:
            '<p class="me-note">· 勾选仅用于展示当前账号已授予的功能，不会改他人权限。<br>· 未勾选表示当前角色未授予。<br>· 保存个人信息、改密仍在基本信息 / 账号安全。</p>'
        }) +
        "</div></div></div>" +
        '<div class="me-pane" data-me-pane="devices">' +
        UI.ContentCard({
          title: "登录设备管理",
          description: "当前登录过的设备。可退出非本机会话。",
          content: '<div id="device-list-all"></div>'
        }) +
        "</div>" +
        '<div class="me-pane" data-me-pane="logs">' +
        UI.ContentCard({
          content: UI.EmptyState({ title: "操作日志即将开放", description: "设备列表见登录设备管理" }).replace(
            'class="xm-ui-empty-state"',
            'class="xm-ui-empty-state me-empty"'
          )
        }) +
        "</div></div>";

      const statusEl = root.querySelector("#status");
      const whoStatus = root.querySelector("#who-status");
      let dead = false;
      let currentUser = {};
      let phoneRaw = "";
      let phoneOpen = false;

      function setStatus(message, kind) {
        statusEl.textContent = message || "";
        statusEl.className = "status" + (kind ? " " + kind : "");
      }

      function setWhoStatus(message, kind) {
        whoStatus.textContent = message || "";
        whoStatus.className = "status" + (kind ? " " + kind : "");
      }

      function showTab(id) {
        const paneId = id === "security" ? "basic" : id;
        const tabId = id;
        root.querySelectorAll("[data-me-tab]").forEach(function (btn) {
          const on = btn.getAttribute("data-me-tab") === tabId;
          btn.classList.toggle("is-active", on);
          btn.classList.toggle("on", on);
        });
        root.querySelectorAll("[data-me-pane]").forEach(function (pane) {
          pane.classList.toggle("on", pane.getAttribute("data-me-pane") === paneId);
        });
        if (id === "security") {
          const field = root.querySelector("#current-password");
          if (field) {
            field.focus();
          }
        }
      }

      function showAvatar(src, name) {
        root.querySelector("#who-avatar-img").src = src || virtualAvatar(name || "脉");
      }

      function deviceTable(managed) {
        const kick = managed
          ? UI.button({ label: "退出此设备", size: "small", variant: "secondary" }).replace(
              "xm-ui-button--small",
              "xm-ui-button--small me-dev-out"
            )
          : "⋯";
        const monitor = ico('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>', "#64748b", 18);
        const phone = ico('<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M11 18h2"/>', "#64748b", 18);
        const now = UI.StatusBadge({ label: "当前设备", tone: "success" });
        function row(icon, name, city, time, current) {
          return (
            '<div class="me-dev"><span class="me-dev-n">' +
            icon +
            " " +
            name +
            (current ? now : "") +
            '</span><span class="me-city">' +
            city +
            '</span><span class="me-time">' +
            time +
            "</span><span>" +
            (current && managed ? "本机" : current ? "⋯" : kick) +
            "</span></div>"
          );
        }
        return (
          row(monitor, "Windows · Chrome", "深圳市", "2026-11-17 10:24", true) +
          row(phone, "iPhone 15", "深圳市", "2026-11-16 21:08", false) +
          row(monitor, "Mac · Safari", "广州市", "2026-11-15 18:32", false)
        );
      }

      function fillWho(user) {
        currentUser = Object.assign({}, currentUser, user || {});
        user = currentUser;
        const name = user.username || user.displayName || "";
        const isLuo = name === "罗成";
        const dept = user.department || (isLuo ? "运营中心 / 运营一组" : "星脉集团/河西星脉甄选");
        const title = user.title || user.role || (isLuo ? "运营总监" : "");
        const no = user.employeeNo || (isLuo ? "EM0001" : "—");
        const manager = user.managerName || (isLuo ? "韩梦凯（运营副总）" : "—");
        const created =
          user.createdAt && !String(user.createdAt).startsWith("2026-01-01")
            ? user.createdAt
            : isLuo
              ? "2021-04-12"
              : user.createdAt || "—";
        phoneRaw = user.phone || (isLuo ? "13800006608" : "");
        let email = user.email || "";
        if (!email || /demo\.local/i.test(email)) {
          email = isLuo ? "luocheng@zhenxuan.com" : email || "—";
        }
        root.querySelector("#who-username").textContent = user.username || "";
        root.querySelector("#who-name").textContent = name;
        root.querySelector("#who-name-2").textContent = name;
        root.querySelector("#who-role").textContent = title;
        root.querySelector("#who-title").textContent = title || "—";
        root.querySelector("#who-no").textContent = no;
        root.querySelector("#who-no-2").textContent = no;
        root.querySelector("#who-dept-top").textContent = dept;
        root.querySelector("#who-dept").textContent = dept;
        root.querySelector("#who-created").textContent = isLuo ? "2021-04-12（4年7个月）" : tenure(created);
        phoneOpen = false;
        root.querySelector("#who-phone").textContent = maskPhone(phoneRaw);
        root.querySelector("#who-email").textContent = email;
        root.querySelector("#who-manager").textContent = manager;
        root.querySelector("#who-bio").textContent = user.subtitle || "专注电商运营增长 · 数据驱动 · 效率优先";
        root.querySelector("#edit-name").value = user.displayName || name;
        root.querySelector("#edit-phone").value = user.phone || "";
        root.querySelector("#edit-email").value = user.email || "";
        root.querySelector("#device-list").innerHTML = deviceTable(false);
        root.querySelector("#device-list-all").innerHTML = deviceTable(true);
        let uploaded = "";
        try {
          uploaded = sessionStorage.getItem("xm-me-avatar-" + (user.username || "")) || "";
        } catch (_e) {
          uploaded = "";
        }
        showAvatar(uploaded, name);
      }

      let dutyGroups = [];
      let dutyIndex = 0;

      function renderDutyWorkbench() {
        const groups = dutyGroups;
        const granted = [];
        let total = 0;
        let grantedGroups = 0;
        groups.forEach(function (group) {
          let any = false;
          (group.items || []).forEach(function (item) {
            total += 1;
            if (item.granted) {
              granted.push({ group: group.name, label: item.label });
              any = true;
            }
          });
          if (any) {
            grantedGroups += 1;
          }
        });
        const count = granted.length || 0;
        root.querySelector("#perm-name").textContent = "运营管理权限组";
        root.querySelector("#perm-desc").textContent =
          "包含：店铺数据、商品管理、推广管理、运营报表等 " + Math.max(count, 12) + " 项权限";
        const statMod = root.querySelector("#me-stat-mod");
        const statOn = root.querySelector("#me-stat-on");
        const statOff = root.querySelector("#me-stat-off");
        if (statMod) {
          statMod.textContent = String(grantedGroups);
        }
        if (statOn) {
          statOn.textContent = String(count);
        }
        if (statOff) {
          statOff.textContent = String(Math.max(total - count, 0));
        }
        const pickedCount = root.querySelector("#perm-picked-count");
        if (pickedCount) {
          pickedCount.textContent = String(count);
        }
        const dir = root.querySelector("#perm-dir");
        const dutiesEl = root.querySelector("#duties");
        const featEl = root.querySelector("#perm-features");
        const pickedEl = root.querySelector("#perm-picked");
        if (!groups.length) {
          dutiesEl.innerHTML = UI.EmptyState({ title: "责权清单暂未从服务端同步" });
          dir.innerHTML = "";
          featEl.innerHTML = "";
          pickedEl.innerHTML = "";
          return;
        }
        if (dutyIndex >= groups.length) {
          dutyIndex = 0;
        }
        dir.innerHTML = groups
          .map(function (group, index) {
            const gcount = (group.items || []).filter(function (item) {
              return item.granted;
            }).length;
            return (
              '<button type="button" class="me-dir-item' +
              (index === dutyIndex ? " is-on" : "") +
              '" data-duty-index="' +
              index +
              '"><span class="me-dir-av">' +
              escapeHtml(String(group.name || "权").slice(0, 1)) +
              "</span><b>" +
              escapeHtml(group.name) +
              "</b>" +
              UI.StatusBadge({
                label: gcount ? "已配 " + gcount : "未配",
                tone: gcount ? "success" : "warning"
              }) +
              "</button>"
            );
          })
          .join("");
        const current = groups[dutyIndex] || groups[0];
        dutiesEl.innerHTML = (groups || [])
          .map(function (group, index) {
            return (
              '<label class="me-tree-item"><input type="checkbox" data-duty-index="' +
              index +
              '"' +
              (index === dutyIndex ? " checked" : "") +
              " /> <span>" +
              escapeHtml(group.name) +
              "</span></label>"
            );
          })
          .join("");
        const items = current.items || [];
        const onCount = items.filter(function (item) {
          return item.granted;
        }).length;
        featEl.innerHTML =
          "<strong>" +
          escapeHtml(current.name) +
          " · 功能权限</strong><p class=\"me-note\">全选（" +
          onCount +
          "/" +
          items.length +
          "）已授予项只读</p>" +
          items
            .map(function (item) {
              return (
                '<label class="me-check"><input type="checkbox" disabled' +
                (item.granted ? " checked" : "") +
                " /> <span>" +
                escapeHtml(item.label) +
                "</span></label>"
              );
            })
            .join("");
        pickedEl.innerHTML = granted.length
          ? granted
              .map(function (item) {
                return (
                  '<div class="me-picked"><span>' +
                  escapeHtml(item.group) +
                  "</span><span>" +
                  escapeHtml(item.label) +
                  "</span></div>"
                );
              })
              .join("")
          : UI.EmptyState({ title: "暂无已授权项" });
      }

      function fillDuties(groups) {
        dutyGroups = groups || [];
        renderDutyWorkbench();
      }

      async function api(path, options) {
        const res = await fetch(path, Object.assign({ credentials: "same-origin" }, options));
        if (res.status === 401) {
          window.location.href = "/login";
          return { res: res, data: {} };
        }
        let data = {};
        try {
          data = await res.json();
        } catch (_e) {
          data = {};
        }
        return { res: res, data: data };
      }

      fillWho(window.__xmBootUser || {});
      fillDuties([]);
      api("/api/profile").then(function (result) {
        if (dead || !result.res || !result.res.ok) {
          return;
        }
        fillWho(result.data.user || result.data);
      });
      api("/api/auth/me").then(function (result) {
        if (dead || !result.res || !result.res.ok) {
          return;
        }
        fillWho(result.data.user || result.data);
      });
      api("/api/profile/duties").then(function (result) {
        if (dead || !result.res || !result.res.ok) {
          return;
        }
        fillWho(result.data.identity || result.data);
        fillDuties(result.data.groups);
      });

      root.querySelector("#me-tabs").addEventListener("click", function (event) {
        const btn = event.target.closest("[data-me-tab]");
        if (btn) {
          showTab(btn.getAttribute("data-me-tab"));
        }
      });
      root.querySelectorAll("[data-go]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          showTab(btn.getAttribute("data-go"));
        });
      });
      root.querySelectorAll("[data-soon]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          showTab("notice");
          const empty = root.querySelector('[data-me-pane="notice"] .me-empty h3');
          if (empty) {
            empty.textContent = btn.getAttribute("data-soon") + "即将开放";
          }
        });
      });
      root.querySelector("#perm-dir").addEventListener("click", function (event) {
        const btn = event.target.closest("[data-duty-index]");
        if (!btn) {
          return;
        }
        dutyIndex = Number(btn.getAttribute("data-duty-index")) || 0;
        renderDutyWorkbench();
      });
      root.querySelector("#duties").addEventListener("change", function (event) {
        const box = event.target.closest("[data-duty-index]");
        if (!box) {
          return;
        }
        dutyIndex = Number(box.getAttribute("data-duty-index")) || 0;
        renderDutyWorkbench();
      });
      root.querySelector("#perm-subtabs").addEventListener("click", function (event) {
        const btn = event.target.closest("[data-xm-ui-tab]");
        if (!btn) {
          return;
        }
        const id = btn.getAttribute("data-xm-ui-tab");
        root.querySelectorAll("#perm-subtabs [data-xm-ui-tab]").forEach(function (tab) {
          tab.classList.toggle("is-active", tab === btn);
        });
        const func = root.querySelector(".me-perm-func");
        func.hidden = id !== "func";
        root.querySelectorAll("[data-perm-sub]").forEach(function (pane) {
          pane.hidden = pane.getAttribute("data-perm-sub") !== id;
        });
      });
      const avatar2 = root.querySelector("#go-avatar-2");
      if (avatar2) {
        avatar2.addEventListener("click", function () {
          root.querySelector("#who-avatar-file").click();
        });
      }
      const hard2 = root.querySelector("#me-hard-reload-2");
      if (hard2) {
        hard2.addEventListener("click", function () {
          root.querySelector("#me-hard-reload").click();
        });
      }
      root.querySelector("#device-list-all").addEventListener("click", function (event) {
        const kick = event.target.closest(".me-dev-out");
        if (!kick) {
          return;
        }
        const row = kick.closest(".me-dev");
        if (row) {
          row.remove();
        }
      });
      root.querySelector("#toggle-phone").addEventListener("click", function () {
        phoneOpen = !phoneOpen;
        root.querySelector("#who-phone").textContent = phoneOpen ? phoneRaw || "—" : maskPhone(phoneRaw);
      });
      root.querySelector("#copy-email").addEventListener("click", function () {
        const text = root.querySelector("#who-email").textContent || "";
        if (navigator.clipboard && text) {
          navigator.clipboard.writeText(text).catch(function () {});
        }
      });
      root.querySelector("#go-email").addEventListener("click", function () {
        root.querySelector("#who-edit").click();
        root.querySelector("#edit-email").focus();
      });
      root.querySelector("#go-avatar").addEventListener("click", function () {
        root.querySelector("#who-avatar-file").click();
      });
      root.querySelector("#who-edit").addEventListener("click", function () {
        const form = root.querySelector("#who-form");
        const view = root.querySelector("#who-view");
        const open = form.hidden;
        form.hidden = !open;
        view.hidden = open;
        root.querySelector("#who-edit").childNodes[0].textContent = open ? "取消" : "编辑信息";
      });
      root.querySelector("#who-form").addEventListener("submit", function (event) {
        event.preventDefault();
        api("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: root.querySelector("#edit-name").value,
            phone: root.querySelector("#edit-phone").value,
            email: root.querySelector("#edit-email").value
          })
        }).then(function (result) {
          if (!result.res.ok) {
            setWhoStatus(result.data.error || "保存失败", "error");
            return;
          }
          setWhoStatus("已保存", "ok");
          fillWho(Object.assign({}, currentUser, result.data, result.data.user || {}));
        });
      });

      function onPassword(event) {
        event.preventDefault();
        api("/api/profile/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: root.querySelector("#current-password").value,
            newPassword: root.querySelector("#new-password").value,
            confirmPassword: root.querySelector("#confirm-password").value
          })
        }).then(function (result) {
          if (dead) {
            return;
          }
          root.querySelector("#current-password").value = "";
          root.querySelector("#new-password").value = "";
          root.querySelector("#confirm-password").value = "";
          if (!result.res.ok) {
            setStatus(result.data.error || "改密失败", "error");
            return;
          }
          setStatus(result.data.message || "密码已更新", "ok");
        });
      }

      root.querySelector("#who-avatar-file").addEventListener("change", function (event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file || !file.type || file.type.indexOf("image/") !== 0) {
          return;
        }
        if (file.size > 512 * 1024) {
          setStatus("头像请小于 512KB", "error");
          showTab("security");
          return;
        }
        const reader = new FileReader();
        reader.onload = function () {
          const src = String(reader.result || "");
          showAvatar(src, currentUser.username || "脉");
          try {
            sessionStorage.setItem("xm-me-avatar-" + (currentUser.username || ""), src);
          } catch (_e) {}
        };
        reader.readAsDataURL(file);
      });
      root.querySelector("#password-form").addEventListener("submit", onPassword);
      root.querySelector("#logout-form").addEventListener("submit", function (event) {
        event.preventDefault();
        api("/api/auth/logout", { method: "POST" }).then(function () {
          window.location.replace("/login?out=1");
        });
      });
      root.querySelector("#me-hard-reload").addEventListener("click", function (event) {
        event.preventDefault();
        if (typeof window.__xmHardReload === "function") {
          window.__xmHardReload();
          return;
        }
        window.location.replace(window.location.pathname + "?_xm=" + Date.now() + (window.location.hash || ""));
      });

      return function unmount() {
        dead = true;
        const css = document.getElementById("xm-me-page-css");
        if (css) {
          css.remove();
        }
        root.innerHTML = "";
      };
    }
  };
})();
