(function () {
  window.XmModules = window.XmModules || {};

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const mod = window.XmModules["/home"];
      if (mod && typeof mod.mount === "function") {
        resolve();
        return;
      }
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        existing.addEventListener("load", resolve);
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function homeClientSrc(html) {
    const match = String(html || "").match(/src="(\/api\/home\/client\.js[^"]*)"/);
    return match ? match[1] : "/api/home/client.js";
  }

  function fetchHomeHtml() {
    return fetch("/home", { credentials: "same-origin" })
      .then(function (res) {
        return res.ok ? res.text() : "";
      })
      .catch(function () {
        return "";
      });
  }

  function openLive(root) {
    const btn = root.querySelector('[data-view="live"]');
    if (btn && !btn.classList.contains("is-on")) {
      btn.click();
    }
  }

  function createLiveDashboard(root) {
    let dead = false;
    let unmountHome = null;
    let poll = 0;
    let clientSrc = "";
    const host = (root && root.querySelector("#board")) || root;

    fetchHomeHtml()
      .then(function (html) {
        if (dead) {
          return;
        }
        clientSrc = homeClientSrc(html);
        return loadScript(clientSrc);
      })
      .then(function () {
        if (dead) {
          return;
        }
        const home = window.XmModules["/home"];
        if (!home || typeof home.mount !== "function") {
          host.innerHTML = '<p class="ch-empty">首页实时页暂不可用</p>';
          return;
        }
        unmountHome = home.mount(host);
        openLive(host);
      })
      .catch(function () {
        if (!dead) {
          host.innerHTML = '<p class="ch-empty">首页实时页暂不可用</p>';
        }
      });

    poll = window.setInterval(function () {
      if (dead) {
        return;
      }
      fetchHomeHtml().then(function (html) {
        const next = homeClientSrc(html);
        if (clientSrc && next && next !== clientSrc) {
          window.location.reload();
        }
      });
    }, 5 * 60 * 1000);

    return function unmount() {
      dead = true;
      window.clearInterval(poll);
      if (typeof unmountHome === "function") {
        unmountHome();
      }
    };
  }

  window.XmDataCreateLiveDashboard = createLiveDashboard;

  const liveModule = {
    mount: function (root) {
      return createLiveDashboard(root);
    }
  };

  try {
    Object.defineProperty(window.XmModules, "/data/paid", {
      configurable: true,
      enumerable: true,
      get: function () {
        return liveModule;
      },
      set: function () {}
    });
  } catch (_err) {
    window.XmModules["/data/paid"] = liveModule;
  }

  const existingBoard = document.getElementById("board");
  if (existingBoard && /\/data\/paid\/?$/.test(location.pathname)) {
    createLiveDashboard(existingBoard.closest(".xm-page") || document.body);
  }
})();
