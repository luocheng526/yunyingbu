/* xm-module-me duties-board logout-in-card */
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
      ".me-page{padding:12px 16px 20px;}" +
      ".me-grid{display:grid;grid-template-columns:300px minmax(0,1fr);gap:12px;align-items:start;}" +
      "@media (max-width:960px){.me-grid{grid-template-columns:1fr;}}" +
      ".me-page .panel{min-height:0;}" +
      ".me-page .panel + .panel{margin-top:12px;}" +
      ".me-info-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--xm-line,#f0f0f0);}" +
      ".me-info-head h2{margin:0;font-size:15px;font-weight:500;}" +
      ".me-info-head span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);}" +
      ".me-avatar{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:148px;margin:0;border:0;cursor:pointer;color:var(--xm-ink,#262626);font-size:14px;background:transparent;width:100%;}" +
      ".me-avatar img{width:72px;height:72px;border-radius:50%;object-fit:cover;}" +
      ".me-avatar input{display:none;}" +
      ".me-kv{display:grid;font-size:14px;}" +
      ".me-kv div{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 0;border-top:1px solid var(--xm-line,#f0f0f0);color:var(--xm-ink,#262626);}" +
      ".me-kv strong{color:var(--xm-ink,#262626);font-weight:400;text-align:right;}" +
      ".me-kv em{display:inline-flex;align-items:center;gap:8px;font-style:normal;}" +
      ".me-ico{width:16px;height:16px;flex:0 0 16px;display:block;}" +
      ".me-page input{display:block;width:100%;margin:0 0 10px;padding:8px 10px;border:1px solid var(--xm-line,#e5e7eb);border-radius:8px;font:inherit;background:var(--xm-card,#fff);color:inherit;box-sizing:border-box;}" +
      ".me-page button.me-btn{display:block;width:100%;border:0;border-radius:8px;padding:9px 12px;font:inherit;background:var(--xm-primary,#1677ff);color:#fff;cursor:pointer;}" +
      ".me-page button.me-btn-logout{margin-top:10px;background:#e11d48;}" +
      ".me-page button.me-btn-logout:hover{background:#be123c;}" +
      ".me-page .status{min-height:1.2em;margin:0 0 8px;font-size:13px;}" +
      ".me-page .status.error{color:#b91c1c;}" +
      ".me-page .status.ok{color:#047857;}" +
      ".me-rights-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:4px;}" +
      ".me-rights-head h2{margin:0;}" +
      ".me-hint{color:var(--xm-muted,#8c8c8c);font-size:12px;}" +
      ".me-group{margin-top:14px;}" +
      ".me-group h3{margin:0 0 8px;font-size:13px;font-weight:600;}" +
      ".me-tags{display:flex;flex-wrap:wrap;gap:6px;}" +
      ".me-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;font-size:12px;background:#d1fae5;color:#065f46;}" +
      ".me-tag.off{background:#e5e7eb;color:#9ca3af;}" +
      "html[data-theme=dark] .me-tag{background:#1e3a5f;color:#93c5fd;}" +
      "html[data-theme=dark] .me-tag.off{background:#2a2820;color:#8a8678;}";
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/me"] = {
    mount: function (root) {
      ensureCss();
      root.innerHTML =
        '<main class="page me-page">' +
        '<div class="me-grid">' +
        "<section>" +
        '<div class="panel" id="who-card">' +
        '<div class="me-info-head"><h2>个人信息</h2><span id="who-username"></span></div>' +
        '<label class="me-avatar" id="who-avatar">' +
        '<img id="who-avatar-img" alt="" hidden />' +
        '<span id="who-avatar-hint">点击上传头像</span>' +
        '<input id="who-avatar-file" type="file" accept="image/*" />' +
        "</label>" +
        '<div class="me-kv">' +
        '<div><em><svg class="me-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5 19c.8-3.2 3.5-5 7-5s6.2 1.8 7 5"/></svg>用户名称</em><strong id="who-name"></strong></div>' +
        '<div><em><svg class="me-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7.5" y="2.5" width="9" height="19" rx="2"/><path d="M11 19.5h2"/></svg>手机号码</em><strong id="who-phone"></strong></div>' +
        '<div><em><svg class="me-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>用户邮箱</em><strong id="who-email"></strong></div>' +
        '<div><em><svg class="me-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V9l8-5 8 5v11"/><path d="M10 20v-7h4v7"/></svg>所属部门</em><strong id="who-dept"></strong></div>' +
        '<div><em><svg class="me-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/></svg>创建日期</em><strong id="who-created"></strong></div>' +
        "</div></div>" +
        '<div class="panel"><h2>修改密码</h2>' +
        '<p id="status" class="status" role="status"></p>' +
        '<form id="password-form" autocomplete="off">' +
        '<input id="current-password" type="password" required placeholder="当前密码" />' +
        '<input id="new-password" type="password" required minlength="8" placeholder="新密码（至少 8 位）" />' +
        '<input id="confirm-password" type="password" required minlength="8" placeholder="再次输入新密码" />' +
        '<button class="me-btn" type="submit">保存新密码</button>' +
        "</form>" +
        '<form id="logout-form"><button class="me-btn me-btn-logout" type="submit">退出登录</button></form>' +
        "</div></section>" +
        '<section class="panel">' +
        '<div class="me-rights-head"><h2>我的责权清单</h2>' +
        '<p class="me-hint">灰色表示当前角色未授予</p></div>' +
        '<div id="duties"></div>' +
        "</section></div></main>";

      const statusEl = root.querySelector("#status");
      let dead = false;

      function setStatus(message, kind) {
        statusEl.textContent = message || "";
        statusEl.className = "status" + (kind ? " " + kind : "");
      }

      function showAvatar(src) {
        const img = root.querySelector("#who-avatar-img");
        const hint = root.querySelector("#who-avatar-hint");
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
        const name = user.displayName || user.username || "";
        root.querySelector("#who-username").textContent = user.username || "";
        root.querySelector("#who-name").textContent = name;
        root.querySelector("#who-phone").textContent = user.phone || "";
        root.querySelector("#who-email").textContent = user.email || "";
        root.querySelector("#who-dept").textContent = user.department || "星脉集团/河西星脉甄选";
        root.querySelector("#who-created").textContent = user.createdAt || "2026-01-01 00:00:00";
        try {
          showAvatar(sessionStorage.getItem("xm-me-avatar-" + (user.username || "")));
        } catch (_e) {
          showAvatar("");
        }
      }

      function fillDuties(groups) {
        root.querySelector("#duties").innerHTML = (groups || [])
          .map(function (group) {
            const tags = (group.items || [])
              .map(function (item) {
                const cls = item.granted ? "me-tag" : "me-tag off";
                const mark = item.granted ? "✓" : "–";
                return (
                  '<span class="' +
                  cls +
                  '">' +
                  mark +
                  " " +
                  escapeHtml(item.label) +
                  "</span>"
                );
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
          return;
        }
        const reader = new FileReader();
        reader.onload = function () {
          const src = String(reader.result || "");
          showAvatar(src);
          try {
            const who = root.querySelector("#who-username").textContent || "";
            sessionStorage.setItem("xm-me-avatar-" + who, src);
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
