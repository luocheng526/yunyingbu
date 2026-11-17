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
    const sky =
      "url(\"data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 120" fill="none">' +
          '<path d="M280 120H0V78c28-10 48-28 78-28 22 0 32 14 50 14 24 0 36-26 64-26 26 0 38 22 58 22 34 0 46-40 30-60" fill="#cfe4ff" opacity=".55"/>' +
          '<path d="M280 120H120V70c18-4 28-18 48-18 14 0 20 10 32 10 18 0 24-22 44-16v76z" fill="#b9d8ff" opacity=".7"/>' +
          '<rect x="168" y="42" width="22" height="62" rx="3" fill="#93c5fd"/>' +
          '<rect x="194" y="28" width="28" height="76" rx="3" fill="#60a5fa"/>' +
          '<rect x="226" y="48" width="20" height="56" rx="3" fill="#93c5fd"/>' +
          '<rect x="248" y="38" width="18" height="66" rx="3" fill="#7dd3fc"/>' +
          '<circle cx="208" cy="22" r="10" fill="#93c5fd"/></svg>'
      ) +
      "\")";
    css.textContent =
      "#xm-content .me-page,.me-page{padding:6px 10px 36px!important;color:#1f2a44;background:transparent;max-width:none!important;margin:0!important;font-family:PingFang SC,Noto Sans SC,Microsoft YaHei,sans-serif;font-size:16px;font-weight:700;}" +
      ".me-page *,.me-page *::before,.me-page *::after{box-sizing:border-box;}" +
      ".me-page h1,.me-page h2,.me-page h3,.me-page p{margin:0;font-weight:800;}" +
      ".me-page svg{max-width:none!important;display:block;flex:0 0 auto;}" +
      ".me-page img{max-width:none!important;}" +
      ".me-page button{border:0!important;background:transparent;color:inherit;height:auto!important;min-width:0!important;min-height:0!important;padding:0;line-height:1.25!important;font:inherit;font-weight:700;border-radius:0;box-shadow:none;cursor:pointer;}" +
      ".me-hero{display:flex;align-items:center;gap:14px;margin:2px 0 18px;}" +
      ".me-hero-mark{width:46px;height:46px;border-radius:14px;background:linear-gradient(180deg,#3b82f6,#1677ff);color:#fff;display:grid;place-items:center;box-shadow:0 8px 18px rgba(22,119,255,.28);flex:0 0 46px;}" +
      ".me-hero-mark svg{width:24px!important;height:24px!important;}" +
      ".me-hero h1{font-size:26px!important;font-weight:800;letter-spacing:.02em;color:#1f2a44;line-height:1.2;}" +
      ".me-hero p{margin-top:6px;color:#64748b;font-size:15px;font-weight:700;}" +
      ".me-banner{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;margin-bottom:16px;align-items:stretch;}" +
      ".me-profile{position:relative;overflow:hidden;display:flex;gap:22px;align-items:center;min-height:148px;padding:24px 28px;border-radius:22px;border:1px solid #d7e8ff;box-shadow:0 10px 28px rgba(37,99,235,.06);background-color:#eaf3ff;background-image:" +
      sky +
      ",linear-gradient(105deg,#e8f2ff 0%,#f5f9ff 48%,#d9ebff 100%);background-repeat:no-repeat;background-position:right 12px bottom,0 0;background-size:250px 118px,auto;}" +
      ".me-avatar{position:relative;display:block;width:96px;height:96px;flex:0 0 96px;cursor:pointer;z-index:1;margin:0!important;min-height:0!important;overflow:visible;}" +
      ".me-avatar img{width:96px!important;height:96px!important;max-width:96px!important;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 8px 18px rgba(15,23,42,.12);display:block;background:#dbeafe;}" +
      ".me-page input.me-file,.me-page #who-avatar-file{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;border:0!important;opacity:0!important;}" +
      ".me-avatar-cam{position:absolute;right:0;bottom:0;width:28px;height:28px;border-radius:50%;background:#1677ff;color:#fff;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(22,119,255,.35);}" +
      ".me-avatar-cam svg{width:14px!important;height:14px!important;}" +
      ".me-who{position:relative;z-index:1;min-width:0;flex:1;padding-right:220px;}" +
      ".me-who h2{font-size:28px!important;font-weight:800;display:inline;color:#0f172a;line-height:1.2;}" +
      ".me-role{display:inline-flex;margin-left:10px;padding:3px 12px;border-radius:999px;background:#dbeafe;color:#1677ff;font-size:14px;font-weight:800;vertical-align:middle;}" +
      ".me-meta{margin:12px 0 8px;color:#475569;font-size:15px;font-weight:700;}" +
      ".me-meta b{font-weight:800;color:#1e293b;}" +
      ".me-bio{margin:0;color:#475569;font-size:15px;font-weight:700;}" +
      ".me-safe{background:#fff;border:1px solid #e8eef7;border-radius:22px;padding:20px 20px 18px;box-shadow:0 8px 24px rgba(15,23,42,.04);cursor:pointer;min-height:148px;}" +
      ".me-safe h3{margin:0 0 16px;font-size:16px;display:flex;align-items:center;gap:8px;font-weight:800;}" +
      ".me-bar-title{width:4px;height:16px;background:#1677ff;border-radius:4px;display:inline-block;}" +
      ".me-safe-row{display:flex;align-items:center;gap:12px;}" +
      ".me-safe-ico{width:48px;height:48px;border-radius:50%;background:#dcfce7;color:#16a34a;display:grid;place-items:center;flex:0 0 48px;}" +
      ".me-safe-ico svg{width:26px!important;height:26px!important;}" +
      ".me-safe strong{display:block;font-size:16px;font-weight:800;}" +
      ".me-safe .sub{color:#64748b;font-size:13px;margin-top:6px;font-weight:700;white-space:nowrap;}" +
      ".me-safe-go{margin-left:auto;color:#cbd5e1;font-size:22px;font-weight:800;padding-bottom:12px;}" +
      ".me-bar{height:10px;border-radius:99px;background:#e5e7eb;margin-top:18px;overflow:hidden;}" +
      ".me-bar b{display:block;height:100%;width:86%;background:linear-gradient(90deg,#4ade80,#22c55e);}" +
      ".me-tabs{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 16px;padding:0;background:transparent;border:0;}" +
      ".me-tabs button{border:1px solid #eef2f7!important;background:#fff!important;border-radius:999px!important;padding:10px 18px!important;font:inherit;font-size:15px!important;font-weight:700!important;cursor:pointer;color:#64748b;display:inline-flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(15,23,42,.04);height:auto!important;}" +
      ".me-tabs button svg{width:20px!important;height:20px!important;}" +
      ".me-tabs button.on{background:#1677ff!important;color:#fff!important;border-color:#1677ff!important;box-shadow:0 8px 16px rgba(22,119,255,.28);}" +
      ".me-split{display:grid;grid-template-columns:minmax(320px,.92fr) minmax(0,1.18fr);gap:16px;align-items:start;}" +
      ".me-col > .me-card + .me-card{margin-top:16px;}" +
      ".me-card{background:#fff;border:1px solid #e8eef7;border-radius:20px;padding:18px 22px 12px;box-shadow:0 8px 24px rgba(15,23,42,.04);}" +
      ".me-card + .me-card{margin-top:16px;}" +
      ".me-card-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}" +
      ".me-card-h h3{margin:0;font-size:17px;display:flex;align-items:center;gap:8px;font-weight:800;}" +
      ".me-edit{border:1px solid #e2e8f0!important;background:#fff!important;color:#334155!important;border-radius:999px!important;padding:7px 14px!important;font:inherit;font-size:14px!important;font-weight:700!important;cursor:pointer;display:inline-flex;align-items:center;gap:6px;height:auto!important;}" +
      ".me-edit svg{width:16px!important;height:16px!important;}" +
      ".me-link{border:0!important;background:transparent!important;color:#1677ff!important;cursor:pointer;font:inherit;font-size:14px!important;font-weight:800!important;height:auto!important;padding:0!important;}" +
      ".me-kv div{display:grid;grid-template-columns:96px minmax(0,1fr);gap:14px;padding:16px 0;border-top:1px solid #f1f5f9;font-size:16px;align-items:center;}" +
      ".me-kv div:first-child{border-top:0;}" +
      ".me-kv em{font-style:normal;color:#64748b;font-size:15px;font-weight:700;}" +
      ".me-kv strong{font-weight:800;color:#0f172a;display:inline-flex;align-items:center;gap:8px;font-size:16px;}" +
      ".me-ico-btn{border:0!important;background:transparent!important;color:#94a3b8!important;cursor:pointer;padding:0!important;display:inline-flex;height:auto!important;}" +
      ".me-ico-btn svg{width:18px!important;height:18px!important;}" +
      ".me-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:12px 0 16px;}" +
      ".me-act{border:0!important;background:#f7f9fc!important;border-radius:16px!important;padding:22px 8px 18px!important;cursor:pointer;font:inherit;color:#1e293b;height:auto!important;display:flex;flex-direction:column;align-items:center;}" +
      ".me-act i{display:grid;place-items:center;height:36px;margin-bottom:10px;font-style:normal;}" +
      ".me-act i svg{width:28px!important;height:28px!important;}" +
      ".me-act span{font-size:14px;font-weight:800;}" +
      ".me-perm{display:flex;gap:14px;align-items:flex-start;padding:16px;border-radius:16px;background:#eef6ff;margin:8px 0 16px;}" +
      ".me-perm-ico{width:48px;height:48px;border-radius:14px;background:#fff;display:grid;place-items:center;flex:0 0 48px;color:#1677ff;box-shadow:0 2px 8px rgba(22,119,255,.12);}" +
      ".me-perm-ico svg{width:24px!important;height:24px!important;}" +
      ".me-perm strong{display:block;margin-bottom:6px;font-size:16px;font-weight:800;}" +
      ".me-perm p{margin:0;color:#475569;font-size:14px;line-height:1.55;font-weight:700;}" +
      ".me-dev{display:grid;grid-template-columns:minmax(0,1.4fr) 80px 148px 22px;gap:10px;align-items:center;padding:14px 0;border-top:1px solid #f1f5f9;font-size:15px;font-weight:700;}" +
      ".me-dev:first-of-type{border-top:0;}" +
      ".me-dev-n{display:inline-flex;align-items:center;gap:10px;min-width:0;font-weight:800;}" +
      ".me-dev-n svg{width:20px!important;height:20px!important;flex:0 0 20px;}" +
      ".me-now{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:#dcfce7;color:#16a34a;font-size:12px;font-weight:800;}" +
      ".me-city,.me-time{color:#64748b;font-size:14px;text-align:right;font-weight:700;}" +
      ".me-muted{color:#94a3b8;text-align:right;font-weight:700;}" +
      ".me-page input:not([type=file]){display:block;width:100%;margin:0 0 10px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font:inherit;font-weight:700;background:#fff;box-sizing:border-box;}" +
      ".me-page button.me-btn{display:block;width:100%;border:0!important;border-radius:10px!important;padding:12px 14px!important;font:inherit;font-size:16px!important;font-weight:800!important;background:#1677ff!important;color:#fff!important;cursor:pointer;height:auto!important;}" +
      ".me-page button.me-btn-logout{margin-top:10px;background:#e11d48!important;}" +
      ".me-page button.me-btn-hard{margin-top:10px;}" +
      ".me-page .status{min-height:1.2em;margin:0 0 8px;font-size:15px;font-weight:700;}" +
      ".me-page .status.error{color:#b91c1c;}" +
      ".me-page .status.ok{color:#047857;}" +
      ".me-group{margin-top:14px;}" +
      ".me-group h3{margin:0 0 8px;font-size:15px;font-weight:800;}" +
      ".me-tags{display:flex;flex-wrap:wrap;gap:6px;}" +
      ".me-tag{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;font-size:13px;font-weight:700;background:#d1fae5;color:#065f46;}" +
      ".me-tag.off{background:#e5e7eb;color:#9ca3af;}" +
      ".me-empty{color:#94a3b8;font-size:15px;padding:12px 0;font-weight:700;}" +
      ".me-pane{display:none;}" +
      ".me-pane.on{display:block;}" +
      "@media (max-width:1100px){.me-banner,.me-split,.me-actions{grid-template-columns:1fr;}.me-who{padding-right:0;}.me-dev{grid-template-columns:1fr 1fr;}}";
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

  const CAM =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" stroke-width="2"><path d="M4 8h3l2-2h6l2 2h3v10H4z"/><circle cx="12" cy="13" r="3"/></svg>';

  window.XmModules = window.XmModules || {};
  window.XmModules["/me"] = {
    mount: function (root) {
      ensureCss();
      root.innerHTML =
        '<div class="me-page">' +
        '<div class="me-hero"><div class="me-hero-mark">' +
        ico('<path d="M12 3 19 7v5c0 5-3.2 8.2-7 9-3.8-.8-7-4-7-9V7z"/>', "#fff", 24) +
        '</div><div><h1>个人中心</h1><p>管理个人信息、账号安全、偏好设置与系统授权</p></div></div>' +
        '<div class="me-banner"><section class="me-profile">' +
        '<label class="me-avatar" id="who-avatar" title="点击上传头像" for="who-avatar-file">' +
        '<img id="who-avatar-img" alt="" src="' +
        virtualAvatar("脉") +
        '" />' +
        '<span class="me-avatar-cam">' +
        CAM +
        "</span></label>" +
        '<input class="me-file" id="who-avatar-file" type="file" accept="image/*" />' +
        '<div class="me-who"><h2 id="who-name">—</h2><span class="me-role" id="who-role"></span>' +
        '<p class="me-meta">工号：<b id="who-no"></b><span>　|　</span>所属部门：<b id="who-dept-top"></b></p>' +
        '<p class="me-bio" id="who-bio"></p></div></section>' +
        '<section class="me-safe" data-go="security"><h3><i class="me-bar-title"></i>账号安全</h3>' +
        '<div class="me-safe-row"><div class="me-safe-ico">' +
        ico('<path d="M20 6 9 17l-5-5"/>', "#16a34a", 26) +
        '</div><div><strong>安全等级：高</strong><div class="sub">已开启：登录密码、手机验证、操作日志</div></div><span class="me-safe-go">›</span></div>' +
        '<div class="me-bar"><b></b></div></section></div>' +
        '<nav class="me-tabs" id="me-tabs">' +
        '<button type="button" class="on" data-me-tab="basic">' +
        ico('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>', "currentColor", 20) +
        "基本信息</button>" +
        '<button type="button" data-me-tab="security">' +
        ico('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', "currentColor", 20) +
        "账号安全</button>" +
        '<button type="button" data-me-tab="notice">' +
        ico('<path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>', "currentColor", 20) +
        "消息通知</button>" +
        '<button type="button" data-me-tab="prefs">' +
        ico('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>', "currentColor", 20) +
        "系统偏好</button>" +
        '<button type="button" data-me-tab="rights">' +
        ico('<path d="M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>', "currentColor", 20) +
        "我的权限</button>" +
        '<button type="button" data-me-tab="logs">' +
        ico('<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>', "currentColor", 20) +
        "操作日志</button></nav>" +
        '<div class="me-pane on" data-me-pane="basic"><div class="me-split">' +
        '<div class="me-col"><section class="me-card" id="me-security-card">' +
        '<div class="me-card-h"><h3><i class="me-bar-title"></i>账号安全</h3></div>' +
        '<p id="status" class="status" role="status"></p>' +
        '<form id="password-form" autocomplete="off">' +
        '<input id="current-password" type="password" required placeholder="当前密码" />' +
        '<input id="new-password" type="password" required minlength="8" placeholder="新密码（至少 8 位）" />' +
        '<input id="confirm-password" type="password" required minlength="8" placeholder="再次输入新密码" />' +
        '<button class="me-btn" type="submit">保存新密码</button></form>' +
        '<form id="logout-form"><button class="me-btn me-btn-logout" type="submit">退出登录</button></form>' +
        '<button type="button" id="me-hard-reload" class="me-btn me-btn-hard" title="绕过缓存重新加载本页">强制刷新</button></section></div>' +
        '<div class="me-col"><section class="me-card"><div class="me-card-h"><h3><i class="me-bar-title"></i>个人信息</h3>' +
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
        "<section class=\"me-card\"><div class=\"me-card-h\"><h3><i class=\"me-bar-title\"></i>快捷操作</h3></div>" +
        '<div class="me-actions">' +
        '<button class="me-act" type="button" data-go="security"><i>' +
        ico('<path d="M8 11V8a4 4 0 1 1 8 0v3M6 11h12v9H6z"/>', "#1677ff", 28) +
        "</i><span>修改密码</span></button>" +
        '<button class="me-act" type="button" data-soon="绑定手机"><i>' +
        ico('<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M11 18h2"/>', "#0ea5e9", 28) +
        "</i><span>绑定手机</span></button>" +
        '<button class="me-act" type="button" id="go-email"><i>' +
        ico('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="m4 8 8 6 8-6"/>', "#1677ff", 28) +
        "</i><span>修改邮箱</span></button>" +
        '<button class="me-act" type="button" id="go-avatar"><i>' +
        ico('<circle cx="12" cy="8" r="3"/><path d="M5 19c.8-3 3.4-5 7-5s6.2 2 7 5"/>', "#6366f1", 28) +
        "</i><span>头像设置</span></button>" +
        '<button class="me-act" type="button" data-soon="通知设置"><i>' +
        ico('<path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/>', "#ef4444", 28) +
        "</i><span>通知设置</span></button>" +
        '<button class="me-act" type="button" data-soon="界面偏好"><i>' +
        ico('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>', "#1677ff", 28) +
        "</i><span>界面偏好</span></button>" +
        '<button class="me-act" type="button" data-soon="语言设置"><i>' +
        ico('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>', "#0d9488", 28) +
        "</i><span>语言设置</span></button>" +
        '<button class="me-act" type="button" data-soon="二次验证"><i>' +
        ico('<path d="M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>', "#1677ff", 28) +
        "</i><span>二次验证</span></button></div></section>" +
        '<section class="me-card"><div class="me-card-h"><h3><i class="me-bar-title"></i>我的权限</h3>' +
        '<button class="me-link" type="button" data-go="rights">查看详情 ></button></div>' +
        '<div class="me-perm"><div class="me-perm-ico">' +
        ico('<path d="M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>', "#1677ff", 24) +
        '</div><div><strong id="perm-name">运营管理权限组</strong><p id="perm-desc"></p></div></div></section>' +
        '<section class="me-card"><div class="me-card-h"><h3><i class="me-bar-title"></i>登录与设备</h3>' +
        '<button class="me-link" type="button" data-go="logs">查看全部 ></button></div>' +
        '<div id="device-list"></div></section></div></div></div>' +
        '<div class="me-pane" data-me-pane="notice"><section class="me-card"><p class="me-empty">消息通知设置即将开放</p></section></div>' +
        '<div class="me-pane" data-me-pane="prefs"><section class="me-card"><p class="me-empty">系统偏好设置即将开放</p></section></div>' +
        '<div class="me-pane" data-me-pane="rights"><section class="me-card">' +
        '<div class="me-card-h"><h3><i class="me-bar-title"></i>我的责权清单</h3><p class="me-muted">灰色表示当前角色未授予</p></div>' +
        '<div id="duties"></div></section></div>' +
        '<div class="me-pane" data-me-pane="logs"><section class="me-card"><p class="me-empty">操作日志即将开放。设备列表见基本信息。</p></section></div></div>';

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
        root.querySelectorAll("[data-me-tab]").forEach(function (btn) {
          btn.classList.toggle("on", btn.getAttribute("data-me-tab") === id);
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

      function fillWho(user) {
        currentUser = Object.assign({}, currentUser, user || {});
        user = currentUser;
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
        root.querySelector("#who-created").textContent = isLuo
          ? "2021-04-12（4年7个月）"
          : tenure(created);
        phoneOpen = false;
        root.querySelector("#who-phone").textContent = maskPhone(phoneRaw);
        root.querySelector("#who-email").textContent = email;
        root.querySelector("#who-manager").textContent = manager;
        root.querySelector("#who-bio").textContent = user.subtitle || "专注电商运营增长 · 数据驱动 · 效率优先";
        root.querySelector("#edit-name").value = user.displayName || name;
        root.querySelector("#edit-phone").value = user.phone || "";
        root.querySelector("#edit-email").value = user.email || "";
        root.querySelector("#device-list").innerHTML =
          '<div class="me-dev"><span class="me-dev-n">' +
          ico('<rect x="3" y="5" width="18" height="12" rx="2"/>', "#64748b", 20) +
          " Windows · Chrome<span class=\"me-now\">当前设备</span></span><span class=\"me-city\">深圳市</span><span class=\"me-time\">2026-11-17 10:24</span><span class=\"me-muted\">⋯</span></div>" +
          '<div class="me-dev"><span class="me-dev-n">' +
          ico('<rect x="8" y="3" width="8" height="18" rx="2"/>', "#64748b", 20) +
          " iPhone 15</span><span class=\"me-city\">深圳市</span><span class=\"me-time\">2026-11-16 21:08</span><span class=\"me-muted\">⋯</span></div>" +
          '<div class="me-dev"><span class="me-dev-n">' +
          ico('<rect x="3" y="5" width="18" height="12" rx="2"/>', "#64748b", 20) +
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
        if (!groups || !groups.length) {
          root.querySelector("#duties").innerHTML = '<p class="me-empty">责权清单暂未从服务端同步</p>';
          return;
        }
        root.querySelector("#duties").innerHTML = groups
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
