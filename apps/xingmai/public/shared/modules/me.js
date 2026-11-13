/* xm-module-me 0.1.65 */
(function () {
  window.XmModules = window.XmModules || {};
  window.XmModules["/me"] = {
    mount: function (root) {
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head"><p class="kicker">星脉</p><h1>个人中心</h1>' +
        '<p class="lead">只改当前账号的显示名、邮箱、手机和密码。</p></header>' +
        '<p id="status" class="status" role="status"></p>' +
        '<div class="stack"><section class="panel"><h2>账号资料</h2>' +
        '<form id="profile-form">' +
        '<label>用户名<input id="profile-username" name="username" type="text" readonly /></label>' +
        '<label>显示名<input id="profile-displayName" name="displayName" type="text" /></label>' +
        '<label>邮箱<input id="profile-email" name="email" type="email" /></label>' +
        '<label>手机<input id="profile-phone" name="phone" type="tel" /></label>' +
        '<div class="actions"><button type="submit">保存资料</button></div></form></section>' +
        '<section class="panel"><h2>修改密码</h2>' +
        '<form id="password-form" autocomplete="off">' +
        '<label>当前密码<input id="current-password" type="password" required /></label>' +
        '<label>新密码<input id="new-password" type="password" required minlength="8" /></label>' +
        '<label>确认新密码<input id="confirm-password" type="password" required minlength="8" /></label>' +
        '<div class="actions"><button type="submit">修改密码</button></div></form></section></div></main>';

      const statusEl = root.querySelector("#status");
      let dead = false;

      function setStatus(message, kind) {
        statusEl.textContent = message || "";
        statusEl.className = "status" + (kind ? " " + kind : "");
      }

      function fill(user) {
        root.querySelector("#profile-username").value = user.username || "";
        root.querySelector("#profile-displayName").value = user.displayName || "";
        root.querySelector("#profile-email").value = user.email || "";
        root.querySelector("#profile-phone").value = user.phone || "";
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

      try {
        const cached = sessionStorage.getItem("xm-me");
        if (cached) {
          fill(JSON.parse(cached));
        }
      } catch (_e) {}

      const now = Date.now();
      if (!window.__xmMeAt || now - window.__xmMeAt > 30000) {
        window.__xmMeAt = now;
        api("/api/auth/me").then(function (result) {
          if (dead) {
            return;
          }
          if (result.res && result.res.ok) {
            fill(result.data);
            try {
              sessionStorage.setItem("xm-me", JSON.stringify(result.data));
            } catch (_e2) {}
          }
        });
      }

      function onProfile(event) {
        event.preventDefault();
        api("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: root.querySelector("#profile-displayName").value,
            email: root.querySelector("#profile-email").value,
            phone: root.querySelector("#profile-phone").value
          })
        }).then(function (result) {
          if (dead) {
            return;
          }
          if (!result.res.ok) {
            setStatus(result.data.error || "保存失败", "error");
            return;
          }
          fill(result.data);
          setStatus("资料已保存", "ok");
        });
      }

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

      root.querySelector("#profile-form").addEventListener("submit", onProfile);
      root.querySelector("#password-form").addEventListener("submit", onPassword);

      return function unmount() {
        dead = true;
        root.innerHTML = "";
      };
    }
  };
})();
