/* xm-module-me profile-workbench-1to1 */
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
    const skins = ["#f6d0b1", "#e8b894", "#d4a574", "#c68642", "#f3c7a8"];
    const hairs = ["#1f2937", "#111827", "#3f2a14", "#4b5563", "#0f172a"];
    const shirts = ["#2563eb", "#1d4ed8", "#0284c7", "#4f46e5", "#0ea5e9"];
    const bgs = ["#dbeafe", "#e0f2fe", "#eef2ff", "#f0f9ff"];
    const skin = skins[h % skins.length];
    const hair = hairs[(h >> 4) % hairs.length];
    const shirt = shirts[(h >> 8) % shirts.length];
    const bg = bgs[(h >> 12) % bgs.length];
    const longHair = h % 3 === 0;
    const hairPath = longHair
      ? '<ellipse cx="40" cy="28" rx="18" ry="14" fill="' +
        hair +
        '"/><rect x="22" y="30" width="6" height="22" rx="3" fill="' +
        hair +
        '"/><rect x="52" y="30" width="6" height="22" rx="3" fill="' +
        hair +
        '"/>'
      : '<path d="M24 36c2-14 12-18 16-18s14 4 16 18v2H24z" fill="' + hair + '"/>';
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">' +
      '<circle cx="40" cy="40" r="40" fill="' +
      bg +
      '"/>' +
      '<ellipse cx="40" cy="82" rx="28" ry="22" fill="' +
      shirt +
      '"/>' +
      hairPath +
      '<circle cx="40" cy="38" r="16" fill="' +
      skin +
      '"/>' +
      '<circle cx="34" cy="37" r="1.6" fill="#1f2937"/><circle cx="46" cy="37" r="1.6" fill="#1f2937"/>' +
      '<path d="M36 45c2.4 2 5.6 2 8 0" fill="none" stroke="#c0846a" stroke-width="1.4" stroke-linecap="round"/>' +
      "</svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function ico(d, c) {
    return (
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="' +
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
      ".me-page{padding:4px 6px 28px;color:#1e293b;font-family:inherit;}" +
      ".me-hero{display:flex;align-items:center;gap:12px;margin:2px 0 14px;}" +
      ".me-hero-mark{width:40px;height:40px;border-radius:12px;background:linear-gradient(180deg,#3b82f6,#2563eb);color:#fff;display:grid;place-items:center;box-shadow:0 8px 16px rgba(37,99,235,.28);}" +
      ".me-hero h1{margin:0;font-size:22px;font-weight:700;letter-spacing:.02em;}" +
      ".me-hero p{margin:3px 0 0;color:#94a3b8;font-size:13px;}" +
      ".me-banner{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;margin-bottom:14px;}" +
      ".me-profile{position:relative;overflow:hidden;display:flex;gap:18px;align-items:center;min-height:118px;padding:18px 22px;border-radius:20px;background:linear-gradient(100deg,#e7f2ff 0%,#f7fbff 46%,#d7e9ff 100%);border:1px solid #dbeafe;box-shadow:0 10px 30px rgba(37,99,235,.06);}" +
      ".me-skyline{position:absolute;right:8px;bottom:0;height:92px;width:210px;opacity:.9;pointer-events:none;}" +
      ".me-avatar{position:relative;display:block;width:84px;height:84px;flex:0 0 84px;cursor:pointer;z-index:1;}" +
      ".me-avatar img{width:84px;height:84px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 8px 18px rgba(15,23,42,.12);display:block;background:#dbeafe;}" +
      ".me-avatar input{display:none;}" +
      ".me-avatar-cam{position:absolute;right:2px;bottom:2px;width:22px;height:22px;border-radius:50%;background:#2563eb;color:#fff;display:grid;place-items:center;border:2px solid #fff;}" +
      ".me-profile h2{margin:0;font-size:24px;font-weight:700;display:inline;}" +
      ".me-role{display:inline-flex;margin-left:10px;padding:2px 10px;border-radius:999px;background:#dbeafe;color:#2563eb;font-size:12px;font-weight:600;vertical-align:middle;}" +
      ".me-meta{margin:8px 0 6px;color:#64748b;font-size:13px;}" +
      ".me-bio{margin:0;color:#475569;font-size:13px;}" +
      ".me-safe{background:#fff;border:1px solid #e8eef7;border-radius:20px;padding:16px 18px 18px;box-shadow:0 8px 24px rgba(15,23,42,.04);}" +
      ".me-safe h3{margin:0 0 14px;font-size:14px;display:flex;align-items:center;gap:8px;}" +
      ".me-bar-title{width:4px;height:14px;background:#2563eb;border-radius:4px;display:inline-block;}" +
      ".me-safe-row{display:flex;align-items:center;gap:12px;}" +
      ".me-safe-ico{width:40px;height:40px;border-radius:50%;background:#dcfce7;color:#16a34a;display:grid;place-items:center;flex:0 0 40px;}" +
      ".me-safe strong{display:block;font-size:14px;}" +
      ".me-safe .sub{color:#94a3b8;font-size:12px;margin-top:4px;}" +
      ".me-bar{height:8px;border-radius:99px;background:#e5e7eb;margin-top:14px;overflow:hidden;}" +
      ".me-bar b{display:block;height:100%;width:82%;background:linear-gradient(90deg,#4ade80,#22c55e);}" +
      ".me-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px;padding:8px;background:#fff;border-radius:16px;border:1px solid #eef2f7;}" +
      ".me-tabs button{border:0;background:transparent;border-radius:999px;padding:8px 14px;font:inherit;cursor:pointer;color:#64748b;display:inline-flex;align-items:center;gap:6px;}" +
      ".me-tabs button.on{background:#2563eb;color:#fff;}" +
      ".me-split{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(320px,1fr);gap:14px;align-items:start;}" +
      ".me-card{background:#fff;border:1px solid #e8eef7;border-radius:18px;padding:16px 18px 8px;box-shadow:0 8px 24px rgba(15,23,42,.04);}" +
      ".me-card + .me-card{margin-top:14px;}" +
      ".me-card-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;}" +
      ".me-card-h h3{margin:0;font-size:15px;display:flex;align-items:center;gap:8px;}" +
      ".me-edit{border:1px solid #e2e8f0;background:#fff;color:#334155;border-radius:999px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;}" +
      ".me-link{border:0;background:transparent;color:#2563eb;cursor:pointer;font:inherit;font-size:13px;}" +
      ".me-kv div{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;padding:13px 0;border-top:1px solid #f1f5f9;font-size:14px;align-items:center;}" +
      ".me-kv div:first-child{border-top:0;}" +
      ".me-kv em{font-style:normal;color:#94a3b8;}" +
      ".me-kv strong{font-weight:600;color:#0f172a;display:inline-flex;align-items:center;gap:8px;}" +
      ".me-ico-btn{border:0;background:transparent;color:#94a3b8;cursor:pointer;padding:0;display:inline-flex;}" +
      ".me-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:8px 0 14px;}" +
      ".me-act{border:0;background:#f8fafc;border-radius:14px;padding:16px 6px 14px;cursor:pointer;font:inherit;color:#334155;}" +
      ".me-act i{display:grid;place-items:center;height:28px;margin-bottom:6px;}" +
      ".me-act span{font-size:12px;}" +
      ".me-perm{display:flex;gap:12px;align-items:flex-start;padding:12px;border-radius:14px;background:#eff6ff;margin:8px 0 14px;}" +
      ".me-perm strong{display:block;margin-bottom:4px;}" +
      ".me-perm p{margin:0;color:#64748b;font-size:12px;line-height:1.55;}" +
      ".me-dev{display:grid;grid-template-columns:1fr auto auto auto;gap:10px;align-items:center;padding:11px 0;border-top:1px solid #f1f5f9;font-size:13px;}" +
      ".me-dev:first-of-type{border-top:0;}" +
      ".me-now{display:inline-block;margin-left:8px;padding:1px 6px;border-radius:999px;background:#dcfce7;color:#16a34a;font-size:11px;}" +
      ".me-city,.me-time{color:#94a3b8;font-size:12px;}" +
      ".me-muted{color:#94a3b8;}" +
      ".me-page input{display:block;width:100%;margin:0 0 10px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;font:inherit;background:#fff;box-sizing:border-box;}" +
      ".me-page button.me-btn{display:block;width:100%;border:0;border-radius:8px;padding:9px 12px;font:inherit;background:#2563eb;color:#fff;cursor:pointer;}" +
      ".me-page button.me-btn-logout{margin-top:10px;background:#e11d48;}" +
      ".me-page button.me-btn-hard{margin-top:10px;}" +
      ".me-page .status{min-height:1.2em;margin:0 0 8px;font-size:13px;}" +
      ".me-page .status.error{color:#b91c1c;}" +
      ".me-page .status.ok{color:#047857;}" +
      ".me-group{margin-top:14px;}" +
      ".me-group h3{margin:0 0 8px;font-size:13px;font-weight:600;}" +
      ".me-tags{display:flex;flex-wrap:wrap;gap:6px;}" +
      ".me-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;font-size:12px;background:#d1fae5;color:#065f46;}" +
      ".me-tag.off{background:#e5e7eb;color:#9ca3af;}" +
      ".me-empty{color:#94a3b8;font-size:13px;padding:12px 0;}" +
      ".me-pane{display:none;}" +
      ".me-pane.on{display:block;}" +
      "@media (max-width:1100px){.me-banner,.me-split,.me-actions{grid-template-columns:1fr;}.me-dev{grid-template-columns:1fr 1fr;}}";
  }

  function maskPhone(phone) {
    const raw = String(phone || "").replace(/\D/g, "");
    if (raw.length >= 7) {
      return raw.slice(0, 3) + "****" + raw.slice(-4);
    }
    return phone || "—";
  }

  function tenure(createdAt) {
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

  function deviceLabel() {
    const ua = String(navigator.userAgent || "");
    if (/iPhone/i.test(ua)) {
      return "iPhone · Safari";
    }
    if (/Android/i.test(ua)) {
      return "Android · Chrome";
    }
    if (/Mac/i.test(ua)) {
      return "Mac · Safari";
    }
    if (/Win/i.test(ua)) {
      return "Windows · Chrome";
    }
    return "Windows · Chrome";
  }

  const SKY =
    '<svg class="me-skyline" viewBox="0 0 210 92" fill="none"><path d="M210 92H0v-18c18-6 32-22 48-22 12 0 18 8 28 8 14 0 22-18 40-18 16 0 22 14 36 14 20 0 28-28 58-20v56z" fill="#bfdbfe" opacity=".55"/><rect x="118" y="28" width="18" height="48" rx="2" fill="#93c5fd"/><rect x="140" y="18" width="22" height="58" rx="2" fill="#60a5fa"/><rect x="166" y="34" width="16" height="42" rx="2" fill="#93c5fd"/><circle cx="151" cy="14" r="8" fill="#93c5fd"/></svg>';
  const CAM =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" stroke-width="2"><path d="M4 8h3l2-2h6l2 2h3v10H4z"/><circle cx="12" cy="13" r="3"/></svg>';

  window.XmModules = window.XmModules || {};
  window.XmModules["/me"] = {
    mount: function (root) {
      ensureCss();
      root.innerHTML =
        '<main class="page me-page">' +
        '<div class="me-hero"><div class="me-hero-mark">' +
        ico('<path d="M12 3 19 7v5c0 5-3.2 8.2-7 9-3.8-.8-7-4-7-9V7z"/>', "#fff") +
        '</div><div><h1>个人中心</h1><p>管理个人信息、账号安全、偏好设置与系统授权</p></div></div>' +
        '<div class="me-banner"><section class="me-profile">' +
        SKY +
        '<label class="me-avatar" id="who-avatar" title="点击上传头像">' +
        '<img id="who-avatar-img" alt="头像" />' +
        '<span class="me-avatar-cam">' +
        CAM +
        "</span>" +
        '<input id="who-avatar-file" type="file" accept="image/*" /></label>' +
        '<div><h2 id="who-name">—</h2><span class="me-role" id="who-role"></span>' +
        '<p class="me-meta">工号：<span id="who-no"></span>　所属部门：<span id="who-dept-top"></span></p>' +
        '<p class="me-bio" id="who-bio"></p></div></section>' +
        '<section class="me-safe"><h3><i class="me-bar-title"></i>账号安全</h3>' +
        '<div class="me-safe-row"><div class="me-safe-ico">' +
        ico('<path d="M20 6 9 17l-5-5"/>', "#16a34a") +
        '</div><div><strong>安全等级：高</strong><div class="sub">已开启：登录密码、手机验证、操作日志</div></div></div>' +
        '<div class="me-bar"><b></b></div></section></div>' +
        '<nav class="me-tabs" id="me-tabs">' +
        '<button type="button" class="on" data-me-tab="basic">' +
        ico('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>') +
        "基本信息</button>" +
        '<button type="button" data-me-tab="security">' +
        ico('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>') +
        "账号安全</button>" +
        '<button type="button" data-me-tab="notice">' +
        ico('<path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>') +
        "消息通知</button>" +
        '<button type="button" data-me-tab="prefs">' +
        ico('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>') +
        "系统偏好</button>" +
        '<button type="button" data-me-tab="rights">' +
        ico('<path d="M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>') +
        "我的权限</button>" +
        '<button type="button" data-me-tab="logs">' +
        ico('<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>') +
        "操作日志</button></nav>" +
        '<div class="me-pane on" data-me-pane="basic"><div class="me-split">' +
        '<section class="me-card"><div class="me-card-h"><h3><i class="me-bar-title"></i>个人信息</h3>' +
        '<button class="me-edit" type="button" id="who-edit">' +
        ico('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>') +
        "编辑信息</button></div>" +
        '<div class="me-kv" id="who-view">' +
        '<div><em>姓名</em><strong id="who-name-2"></strong></div>' +
        '<div><em>工号</em><strong id="who-no-2"></strong></div>' +
        '<div><em>部门</em><strong id="who-dept"></strong></div>' +
        '<div><em>岗位</em><strong id="who-title"></strong></div>' +
        '<div><em>入职日期</em><strong id="who-created"></strong></div>' +
        '<div><em>联系方式</em><strong><span id="who-phone"></span> <button class="me-ico-btn" type="button" id="toggle-phone" title="显示">' +
        ico('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>') +
        "</button></strong></div>" +
        '<div><em>邮箱</em><strong><span id="who-email"></span> <button class="me-ico-btn" type="button" id="copy-email" title="复制">' +
        ico('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>') +
        "</button></strong></div>" +
        '<div><em>汇报对象</em><strong id="who-manager"></strong></div></div>' +
        '<form id="who-form" hidden><p id="who-status" class="status"></p>' +
        '<input id="edit-name" placeholder="姓名" />' +
        '<input id="edit-phone" placeholder="联系方式" />' +
        '<input id="edit-email" placeholder="邮箱" />' +
        '<button class="me-btn" type="submit">保存信息</button></form>' +
        '<span id="who-username" hidden></span></section>' +
        "<div><section class=\"me-card\"><div class=\"me-card-h\"><h3><i class=\"me-bar-title\"></i>快捷操作</h3></div>" +
        '<div class="me-actions">' +
        '<button class="me-act" type="button" data-go="security"><i>' +
        ico('<path d="M8 11V8a4 4 0 1 1 8 0v3M6 11h12v9H6z"/>', "#2563eb") +
        "</i><span>修改密码</span></button>" +
        '<button class="me-act" type="button" data-soon="绑定手机"><i>' +
        ico('<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M11 18h2"/>', "#0ea5e9") +
        "</i><span>绑定手机</span></button>" +
        '<button class="me-act" type="button" id="go-email"><i>' +
        ico('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="m4 8 8 6 8-6"/>', "#2563eb") +
        "</i><span>修改邮箱</span></button>" +
        '<button class="me-act" type="button" id="go-avatar"><i>' +
        ico('<circle cx="12" cy="8" r="3"/><path d="M5 19c.8-3 3.4-5 7-5s6.2 2 7 5"/>', "#6366f1") +
        "</i><span>头像设置</span></button>" +
        '<button class="me-act" type="button" data-soon="通知设置"><i>' +
        ico('<path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/>', "#ef4444") +
        "</i><span>通知设置</span></button>" +
        '<button class="me-act" type="button" data-soon="界面偏好"><i>' +
        ico('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>', "#2563eb") +
        "</i><span>界面偏好</span></button>" +
        '<button class="me-act" type="button" data-soon="语言设置"><i>' +
        ico('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>', "#0d9488") +
        "</i><span>语言设置</span></button>" +
        '<button class="me-act" type="button" data-soon="二次验证"><i>' +
        ico('<path d="M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>', "#2563eb") +
        "</i><span>二次验证</span></button></div></section>" +
        '<section class="me-card"><div class="me-card-h"><h3><i class="me-bar-title"></i>我的权限</h3>' +
        '<button class="me-link" type="button" data-go="rights">查看详情 ></button></div>' +
        '<div class="me-perm">' +
        ico('<path d="M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>', "#2563eb") +
        '<div><strong id="perm-name">运营管理权限组</strong><p id="perm-desc"></p></div></div></section>' +
        '<section class="me-card"><div class="me-card-h"><h3><i class="me-bar-title"></i>登录与设备</h3>' +
        '<button class="me-link" type="button" data-go="logs">查看全部 ></button></div>' +
        '<div id="device-list"></div></section></div></div></div>' +
        '<div class="me-pane" data-me-pane="security"><section class="me-card" style="max-width:420px">' +
        "<h3>账号安全</h3><p id=\"status\" class=\"status\" role=\"status\"></p>" +
        '<form id="password-form" autocomplete="off">' +
        '<input id="current-password" type="password" required placeholder="当前密码" />' +
        '<input id="new-password" type="password" required minlength="8" placeholder="新密码（至少 8 位）" />' +
        '<input id="confirm-password" type="password" required minlength="8" placeholder="再次输入新密码" />' +
        '<button class="me-btn" type="submit">保存新密码</button></form>' +
        '<form id="logout-form"><button class="me-btn me-btn-logout" type="submit">退出登录</button></form>' +
        '<button type="button" id="me-hard-reload" class="me-btn me-btn-hard" title="绕过缓存重新加载本页">强制刷新</button></section></div>' +
        '<div class="me-pane" data-me-pane="notice"><section class="me-card"><p class="me-empty">消息通知设置即将开放</p></section></div>' +
        '<div class="me-pane" data-me-pane="prefs"><section class="me-card"><p class="me-empty">系统偏好设置即将开放</p></section></div>' +
        '<div class="me-pane" data-me-pane="rights"><section class="me-card">' +
        '<div class="me-card-h"><h3><i class="me-bar-title"></i>我的责权清单</h3><p class="me-muted">灰色表示当前角色未授予</p></div>' +
        '<div id="duties"></div></section></div>' +
        '<div class="me-pane" data-me-pane="logs"><section class="me-card"><p class="me-empty">操作日志即将开放。设备列表见基本信息。</p></section></div></main>';

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
        root.querySelectorAll("[data-me-tab]").forEach(function (btn) {
          btn.classList.toggle("on", btn.getAttribute("data-me-tab") === id);
        });
        root.querySelectorAll("[data-me-pane]").forEach(function (pane) {
          pane.classList.toggle("on", pane.getAttribute("data-me-pane") === id);
        });
      }

      function showAvatar(src, name) {
        root.querySelector("#who-avatar-img").src = src || virtualAvatar(name || "脉");
      }

      function fillWho(user) {
        currentUser = user || {};
        const name = user.username || user.displayName || "";
        const isLuo = name === "罗成";
        const dept = user.department || (isLuo ? "运营中心 / 运营一组" : "星脉集团/河西星脉甄选");
        const title = user.title || user.role || (isLuo ? "运营总监" : "");
        const no = user.employeeNo || (isLuo ? "EM0001" : "—");
        const manager = user.managerName || (isLuo ? "韩梦凯（运营副总）" : "—");
        const created = user.createdAt && !String(user.createdAt).startsWith("2026-01-01")
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
        root.querySelector("#who-created").textContent = tenure(created);
        phoneOpen = false;
        root.querySelector("#who-phone").textContent = maskPhone(phoneRaw);
        root.querySelector("#who-email").textContent = email;
        root.querySelector("#who-manager").textContent = manager;
        root.querySelector("#who-bio").textContent = user.subtitle || "专注电商运营增长 · 数据驱动 · 效率优先";
        root.querySelector("#edit-name").value = user.displayName || name;
        root.querySelector("#edit-phone").value = user.phone || "";
        root.querySelector("#edit-email").value = user.email || "";
        const now = new Date();
        const stamp =
          now.getFullYear() +
          "-" +
          String(now.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(now.getDate()).padStart(2, "0") +
          " " +
          String(now.getHours()).padStart(2, "0") +
          ":" +
          String(now.getMinutes()).padStart(2, "0");
        root.querySelector("#device-list").innerHTML =
          '<div class="me-dev"><span>' +
          ico('<rect x="3" y="5" width="18" height="12" rx="2"/>', "#64748b") +
          " " +
          escapeHtml(deviceLabel()) +
          '<span class="me-now">当前设备</span></span><span class="me-city">深圳市</span><span class="me-time">' +
          stamp +
          "</span><span class=\"me-muted\">⋯</span></div>" +
          '<div class="me-dev"><span>' +
          ico('<rect x="8" y="3" width="8" height="18" rx="2"/>', "#64748b") +
          " iPhone 15</span><span class=\"me-city\">深圳市</span><span class=\"me-time\">2026-11-16 21:08</span><span class=\"me-muted\">⋯</span></div>" +
          '<div class="me-dev"><span>' +
          ico('<rect x="3" y="5" width="18" height="12" rx="2"/>', "#64748b") +
          " Mac · Safari</span><span class=\"me-city\">广州市</span><span class=\"me-time\">2026-11-15 18:32</span><span class=\"me-muted\">⋯</span></div>";
        let uploaded = "";
        try {
          uploaded = sessionStorage.getItem("xm-me-avatar-" + (user.username || "")) || "";
        } catch (_e) {
          uploaded = "";
        }
        showAvatar(uploaded, name);
      }

      function fillDuties(groups) {
        const granted = [];
        (groups || []).forEach(function (group) {
          (group.items || []).forEach(function (item) {
            if (item.granted) {
              granted.push(item.label);
            }
          });
        });
        root.querySelector("#perm-name").textContent = "运营管理权限组";
        root.querySelector("#perm-desc").textContent =
          "包含：店铺数据、商品管理、推广管理、运营报表等 " +
          Math.max(granted.length, 12) +
          " 项权限";
        root.querySelector("#duties").innerHTML = (groups || [])
          .map(function (group) {
            const tags = (group.items || [])
              .map(function (item) {
                const cls = item.granted ? "me-tag" : "me-tag off";
                const mark = item.granted ? "✓" : "–";
                return '<span class="' + cls + '">' + mark + " " + escapeHtml(item.label) + "</span>";
              })
              .join("");
            return (
              '<div class="me-group"><h3>' +
              escapeHtml(group.name) +
              '</h3><div class="me-tags">' +
              tags +
              "</div></div>"
            );
          })
          .join("");
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
          showTab("prefs");
          root.querySelector('[data-me-pane="prefs"] .me-empty').textContent =
            btn.getAttribute("data-soon") + "即将开放";
        });
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
        root.querySelector("#who-edit").lastChild.textContent = open ? "取消" : "编辑信息";
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
        window.location.replace(
          window.location.pathname + "?_xm=" + Date.now() + (window.location.hash || "")
        );
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
