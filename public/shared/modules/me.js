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
      ".me-who{display:flex;gap:12px;align-items:center;margin-bottom:14px;}" +
      ".me-badge{width:40px;height:40px;border-radius:8px;background:var(--xm-primary,#1677ff);color:#fff;display:grid;place-items:center;font-size:16px;flex-shrink:0;}" +
      ".me-who h2{margin:0;font-size:16px;}" +
      ".me-who p{margin:4px 0 0;color:var(--xm-muted,#8c8c8c);font-size:13px;}" +
      ".me-kv{display:grid;gap:8px;font-size:13px;}" +
      ".me-kv div{display:flex;justify-content:space-between;gap:12px;color:var(--xm-muted,#8c8c8c);}" +
      ".me-kv strong{color:var(--xm-ink,#111);font-weight:600;}" +
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
        '<div class="me-who"><div class="me-badge" id="who-badge">系</div>' +
        '<div><h2 id="who-title">个人中心</h2><p id="who-subtitle"></p></div></div>' +
        '<div class="me-kv">' +
        '<div>登录账号<strong id="who-username"></strong></div>' +
        '<div>数据范围<strong id="who-scope"></strong></div>' +
        '<div>角色<strong id="who-role"></strong></div>' +
        '<div>权限项<strong id="who-count"></strong></div>' +
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

      function fillWho(user) {
        root.querySelector("#who-badge").textContent = user.badge || "系";
        root.querySelector("#who-title").textContent = user.title || user.displayName || "个人中心";
        root.querySelector("#who-subtitle").textContent = user.subtitle || "";
        root.querySelector("#who-username").textContent = user.username || "";
        root.querySelector("#who-scope").textContent = user.dataScope || "";
        root.querySelector("#who-role").textContent = user.role || "";
        const count = user.grantedCount != null ? user.grantedCount : 0;
        const total = user.dutyTotal != null ? user.dutyTotal : count;
        root.querySelector("#who-count").textContent = count + " 项" + (total ? " / " + total : "");
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
