/* xm-module-me profile-workbench */
(function () {
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensureCss() {
    let css = document.getElementById("xm-me-page-css");
    if (!css) {
      css = document.createElement("style");
      css.id = "xm-me-page-css";
      document.head.appendChild(css);
    }
    css.textContent =
      ".me-page{padding:8px 8px 24px;color:var(--xm-ink,#1f2937);}" +
      ".me-hero{display:flex;align-items:center;gap:10px;margin:0 0 12px;}" +
      ".me-hero-mark{width:36px;height:36px;border-radius:12px;background:linear-gradient(180deg,#3b82f6,#2563eb);color:#fff;display:grid;place-items:center;font-weight:700;flex:0 0 36px;}" +
      ".me-hero h1{margin:0;font-size:22px;font-weight:700;}" +
      ".me-hero p{margin:2px 0 0;color:#64748b;font-size:13px;}" +
      ".me-banner{display:grid;grid-template-columns:minmax(0,1.4fr) 320px;gap:12px;margin-bottom:12px;}" +
      ".me-profile{position:relative;overflow:hidden;display:flex;gap:16px;align-items:center;padding:18px 20px;border-radius:18px;background:linear-gradient(105deg,#e8f2ff 0%,#f4f8ff 42%,#dbeafe 100%);border:1px solid #dbeafe;}" +
      ".me-avatar{position:relative;display:block;width:76px;height:76px;flex:0 0 76px;cursor:pointer;}" +
      ".me-avatar img,.me-avatar-fallback{width:76px;height:76px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 4px 14px rgba(37,99,235,.18);display:block;}" +
      ".me-avatar-fallback{display:grid;place-items:center;background:#2563eb;color:#fff;font-size:28px;font-weight:700;}" +
      ".me-avatar input{display:none;}" +
      ".me-avatar-cam{position:absolute;right:0;bottom:0;width:22px;height:22px;border-radius:50%;background:#2563eb;color:#fff;display:grid;place-items:center;border:2px solid #fff;font-size:11px;}" +
      ".me-profile h2{margin:0;font-size:22px;display:inline;}" +
      ".me-role{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:12px;vertical-align:middle;}" +
      ".me-meta{margin:6px 0;color:#64748b;font-size:13px;}" +
      ".me-bio{margin:0;color:#334155;font-size:13px;}" +
      ".me-safe{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:16px 18px;}" +
      ".me-safe h3{margin:0 0 10px;font-size:14px;display:flex;align-items:center;gap:8px;}" +
      ".me-safe h3 i{width:4px;height:14px;background:#2563eb;border-radius:4px;display:inline-block;}" +
      ".me-safe-row{display:flex;align-items:center;gap:10px;}" +
      ".me-safe-ico{width:36px;height:36px;border-radius:50%;background:#dcfce7;color:#16a34a;display:grid;place-items:center;font-size:18px;}" +
      ".me-safe strong{display:block;font-size:14px;}" +
      ".me-safe span{color:#64748b;font-size:12px;}" +
      ".me-bar{height:8px;border-radius:99px;background:#e5e7eb;margin-top:10px;overflow:hidden;}" +
      ".me-bar b{display:block;height:100%;width:86%;background:#22c55e;}" +
      ".me-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px;}" +
      ".me-tabs button{border:0;background:#fff;border:1px solid #e5e7eb;border-radius:999px;padding:8px 14px;font:inherit;cursor:pointer;color:#475569;}" +
      ".me-tabs button.on{background:#2563eb;color:#fff;border-color:#2563eb;}" +
      ".me-split{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:12px;align-items:start;}" +
      ".me-card{background:#fff;border:1px solid #e8eef7;border-radius:16px;padding:16px 18px;}" +
      ".me-card + .me-card{margin-top:12px;}" +
      ".me-card-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}" +
      ".me-card-h h3{margin:0;font-size:15px;display:flex;align-items:center;gap:8px;}" +
      ".me-card-h h3 i{width:4px;height:14px;background:#2563eb;border-radius:4px;display:inline-block;}" +
      ".me-link{border:0;background:transparent;color:#2563eb;cursor:pointer;font:inherit;font-size:13px;}" +
      ".me-kv div{display:grid;grid-template-columns:88px 1fr;gap:12px;padding:11px 0;border-top:1px solid #f1f5f9;font-size:14px;}" +
      ".me-kv div:first-child{border-top:0;}" +
      ".me-kv em{font-style:normal;color:#94a3b8;}" +
      ".me-kv strong{font-weight:600;color:#0f172a;}" +
      ".me-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}" +
      ".me-act{border:0;background:#f8fafc;border-radius:12px;padding:14px 8px;cursor:pointer;font:inherit;color:#334155;}" +
      ".me-act b{display:block;font-size:20px;margin-bottom:6px;}" +
      ".me-act span{font-size:12px;}" +
      ".me-perm{display:flex;gap:12px;align-items:flex-start;padding:12px;border-radius:12px;background:#eff6ff;}" +
      ".me-perm strong{display:block;margin-bottom:4px;}" +
      ".me-perm p{margin:0;color:#64748b;font-size:12px;line-height:1.5;}" +
      ".me-dev{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 0;border-top:1px solid #f1f5f9;font-size:13px;}" +
      ".me-dev:first-of-type{border-top:0;}" +
      ".me-now{color:#16a34a;font-size:12px;margin-left:6px;}" +
      ".me-muted{color:#94a3b8;}" +
      ".me-page input,.me-page textarea{display:block;width:100%;margin:0 0 10px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;font:inherit;background:#fff;box-sizing:border-box;}" +
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
      "@media (max-width:1100px){.me-banner,.me-split,.me-actions{grid-template-columns:1fr;}}";
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
    return "当前浏览器";
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/me"] = {
    mount: function (root) {
      ensureCss();
      root.innerHTML =
        '<main class="page me-page">' +
        '<div class="me-hero"><div class="me-hero-mark">脉</div><div><h1>个人中心</h1><p>管理个人信息、账号安全、偏好设置与系统授权</p></div></div>' +
        '<div class="me-banner">' +
        '<section class="me-profile">' +
        '<label class="me-avatar" id="who-avatar" title="点击上传头像">' +
        '<img id="who-avatar-img" alt="" hidden />' +
        '<span class="me-avatar-fallback" id="who-avatar-hint">罗</span>' +
        '<span class="me-avatar-cam">📷</span>' +
        '<input id="who-avatar-file" type="file" accept="image/*" />' +
        "</label>" +
        "<div><h2 id=\"who-name\">—</h2><span class=\"me-role\" id=\"who-role\"></span>" +
        '<p class="me-meta">工号：<span id="who-no"></span>　所属部门：<span id="who-dept-top"></span></p>' +
        '<p class="me-bio" id="who-bio"></p></div></section>' +
        '<section class="me-safe"><h3><i></i>账号安全</h3>' +
        '<div class="me-safe-row"><div class="me-safe-ico">✓</div><div><strong>安全等级：高</strong><span>已开启：登录密码、操作日志</span></div></div>' +
        '<div class="me-bar"><b></b></div></section></div>' +
        '<nav class="me-tabs" id="me-tabs">' +
        '<button type="button" class="on" data-me-tab="basic">基本信息</button>' +
        '<button type="button" data-me-tab="security">账号安全</button>' +
        '<button type="button" data-me-tab="notice">消息通知</button>' +
        '<button type="button" data-me-tab="prefs">系统偏好</button>' +
        '<button type="button" data-me-tab="rights">我的权限</button>' +
        '<button type="button" data-me-tab="logs">操作日志</button>' +
        "</nav>" +
        '<div class="me-pane on" data-me-pane="basic"><div class="me-split">' +
        '<section class="me-card"><div class="me-card-h"><h3><i></i>个人信息</h3>' +
        '<button class="me-link" type="button" id="who-edit">编辑信息</button></div>' +
        '<div class="me-kv" id="who-view">' +
        '<div><em>姓名</em><strong id="who-name-2"></strong></div>' +
        '<div><em>工号</em><strong id="who-no-2"></strong></div>' +
        '<div><em>部门</em><strong id="who-dept"></strong></div>' +
        '<div><em>岗位</em><strong id="who-title"></strong></div>' +
        '<div><em>入职日期</em><strong id="who-created"></strong></div>' +
        '<div><em>联系方式</em><strong id="who-phone"></strong></div>' +
        '<div><em>邮箱</em><strong id="who-email"></strong></div>' +
        '<div><em>汇报对象</em><strong id="who-manager"></strong></div>' +
        "</div>" +
        '<form id="who-form" hidden><p id="who-status" class="status"></p>' +
        '<input id="edit-name" placeholder="姓名" />' +
        '<input id="edit-phone" placeholder="联系方式" />' +
        '<input id="edit-email" placeholder="邮箱" />' +
        '<button class="me-btn" type="submit">保存信息</button></form>' +
        '<span id="who-username" hidden></span></section>' +
        "<div><section class=\"me-card\"><div class=\"me-card-h\"><h3><i></i>快捷操作</h3></div>" +
        '<div class="me-actions">' +
        '<button class="me-act" type="button" data-go="security"><b>🔑</b><span>修改密码</span></button>' +
        '<button class="me-act" type="button" data-soon="绑定手机"><b>☎</b><span>绑定手机</span></button>' +
        '<button class="me-act" type="button" id="go-email"><b>✉</b><span>修改邮箱</span></button>' +
        '<button class="me-act" type="button" id="go-avatar"><b>👤</b><span>头像设置</span></button>' +
        '<button class="me-act" type="button" data-soon="通知设置"><b>🔔</b><span>通知设置</span></button>' +
        '<button class="me-act" type="button" data-soon="界面偏好"><b>🖥</b><span>界面偏好</span></button>' +
        '<button class="me-act" type="button" data-soon="语言设置"><b>🌐</b><span>语言设置</span></button>' +
        '<button class="me-act" type="button" data-soon="二次验证"><b>🛡</b><span>二次验证</span></button>' +
        "</div></section>" +
        '<section class="me-card"><div class="me-card-h"><h3><i></i>我的权限</h3>' +
        '<button class="me-link" type="button" data-go="rights">查看详情</button></div>' +
        '<div class="me-perm"><div>🛡</div><div><strong id="perm-name">—</strong><p id="perm-desc"></p></div></div></section>' +
        '<section class="me-card"><div class="me-card-h"><h3><i></i>登录与设备</h3></div>' +
        '<div class="me-dev"><span>💻 <span id="dev-now"></span><span class="me-now">当前设备</span></span><span class="me-muted" id="dev-time"></span></div>' +
        "</section></div></div></div>" +
        '<div class="me-pane" data-me-pane="security"><section class="me-card" style="max-width:420px">' +
        "<h3>账号安全</h3><p id=\"status\" class=\"status\" role=\"status\"></p>" +
        '<form id="password-form" autocomplete="off">' +
        '<input id="current-password" type="password" required placeholder="当前密码" />' +
        '<input id="new-password" type="password" required minlength="8" placeholder="新密码（至少 8 位）" />' +
        '<input id="confirm-password" type="password" required minlength="8" placeholder="再次输入新密码" />' +
        '<button class="me-btn" type="submit">保存新密码</button></form>' +
        '<form id="logout-form"><button class="me-btn me-btn-logout" type="submit">退出登录</button></form>' +
        '<button type="button" id="me-hard-reload" class="me-btn me-btn-hard" title="绕过缓存重新加载本页">强制刷新</button>' +
        "</section></div>" +
        '<div class="me-pane" data-me-pane="notice"><section class="me-card"><p class="me-empty">消息通知设置即将开放</p></section></div>' +
        '<div class="me-pane" data-me-pane="prefs"><section class="me-card"><p class="me-empty">系统偏好设置即将开放</p></section></div>' +
        '<div class="me-pane" data-me-pane="rights"><section class="me-card">' +
        '<div class="me-card-h"><h3><i></i>我的责权清单</h3><p class="me-muted">灰色表示当前角色未授予</p></div>' +
        '<div id="duties"></div></section></div>' +
        '<div class="me-pane" data-me-pane="logs"><section class="me-card"><p class="me-empty">操作日志即将开放。当前设备已显示在基本信息。</p></section></div>' +
        "</main>";

      const statusEl = root.querySelector("#status");
      const whoStatus = root.querySelector("#who-status");
      let dead = false;
      let currentUser = {};

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

      function showAvatar(src, fallback) {
        const img = root.querySelector("#who-avatar-img");
        const hint = root.querySelector("#who-avatar-hint");
        hint.textContent = (fallback || "脉").slice(0, 1);
        if (src) {
          img.src = src;
          img.hidden = false;
          hint.hidden = true;
        } else {
          img.removeAttribute("src");
          img.hidden = true;
          hint.hidden = false;
        }
      }

      function fillWho(user) {
        currentUser = user || {};
        const name = user.username || user.displayName || "";
        const dept = user.department || "星脉集团/河西星脉甄选";
        const title = user.title || user.role || "";
        const no = user.employeeNo || (name === "罗成" ? "EM0001" : "—");
        const manager = user.managerName || (name === "罗成" ? "韩梦凯（运营副总）" : "—");
        const created = user.createdAt || "2026-01-01 00:00:00";
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
        root.querySelector("#who-phone").textContent = maskPhone(user.phone);
        root.querySelector("#who-email").textContent = user.email || "—";
        root.querySelector("#who-manager").textContent = manager;
        root.querySelector("#who-bio").textContent = user.subtitle || "专注电商运营增长 · 数据驱动 · 效率优先";
        root.querySelector("#edit-name").value = user.displayName || name;
        root.querySelector("#edit-phone").value = user.phone || "";
        root.querySelector("#edit-email").value = user.email || "";
        root.querySelector("#dev-now").textContent = deviceLabel();
        root.querySelector("#dev-time").textContent = new Date().toISOString().slice(0, 16).replace("T", " ");
        try {
          showAvatar(sessionStorage.getItem("xm-me-avatar-" + (user.username || "")), name);
        } catch (_e) {
          showAvatar("", name);
        }
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
        root.querySelector("#perm-name").textContent = (groups && groups[0] && groups[0].name) || "运营管理权限组";
        root.querySelector("#perm-desc").textContent =
          "包含：" +
          (granted.slice(0, 4).join("、") || "店铺数据、商品管理") +
          (granted.length > 4 ? " 等 " + granted.length + " 项权限" : "");
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
        root.querySelector("#who-edit").textContent = open ? "取消" : "编辑信息";
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
