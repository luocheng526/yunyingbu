/* xm-module-home 0.1.113-desk */
(function () {
  var THEME_LABEL = { light: "正常蓝", dark: "晚上黑", pink: "甄选粉" };

  var FALLBACK = {
    greeting: "欢迎回到运营工作台",
    cards: [
      { key: "queue", label: "待发版", value: "—", unit: "单" },
      { key: "centers", label: "业务中心", value: "6", unit: "个" },
      { key: "session", label: "登录保持", value: "7", unit: "天" },
      { key: "theme", label: "页面风格", value: "跟随顶栏", unit: "" }
    ],
    notices: [
      { title: "发版闸门", text: "上线只走版本发布中心。点「通过」才落地，禁止插队。" },
      { title: "经营数据", text: "看板在数据中心。本页只做工作台，不重复画指标大盘。" },
      { title: "组织与账号", text: "花名册在组织中心，资料和密码在个人中心。" }
    ],
    entries: [
      { href: "/data/overview", label: "数据总揽", hint: "看经营指标" },
      { href: "/releases", label: "版本发布中心", hint: "待放行单据" },
      { href: "/people", label: "组织中心", hint: "花名册与店权" },
      { href: "/me", label: "个人中心", hint: "资料与改密" },
      { href: "/agents", label: "甄选智能体", hint: "对话与接入" },
      { href: "/academy/courses", label: "培训课程", hint: "商学院课件" }
    ]
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function chinaNow() {
    var parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(new Date());
    var pick = function (type) {
      return (parts.find(function (part) {
        return part.type === type;
      }) || {}).value || "";
    };
    return {
      date:
        pick("year") +
        "-" +
        pick("month") +
        "-" +
        pick("day") +
        " " +
        pick("hour") +
        ":" +
        pick("minute") +
        ":" +
        pick("second"),
      weekday: pick("weekday"),
      hour: Number(pick("hour")) || 0
    };
  }

  function greetWord(hour) {
    if (hour < 5) {
      return "夜里好";
    }
    if (hour < 11) {
      return "早上好";
    }
    if (hour < 13) {
      return "中午好";
    }
    if (hour < 18) {
      return "下午好";
    }
    return "晚上好";
  }

  function readUser() {
    var boot = window.__xmBootUser;
    if (boot && (boot.displayName || boot.username)) {
      return boot;
    }
    try {
      var cached = sessionStorage.getItem("xm-me");
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (_err) {}
    return null;
  }

  function themeName() {
    var theme = document.documentElement.getAttribute("data-theme") || "light";
    return THEME_LABEL[theme] || THEME_LABEL.light;
  }

  function cardHtml(card) {
    return (
      '<article class="kpi-card" data-home-card="' +
      escapeHtml(card.key || card.label || "") +
      '"><div class="label">' +
      escapeHtml(card.label || "") +
      '</div><div class="value">' +
      escapeHtml(card.value == null ? "—" : card.value) +
      (card.unit ? '<span class="unit">' + escapeHtml(card.unit) + "</span>" : "") +
      "</div></article>"
    );
  }

  function noticeHtml(row) {
    return (
      "<li><span class=\"name\">" +
      escapeHtml(row.title || "") +
      "</span><span class=\"hint\">" +
      escapeHtml(row.text || "") +
      "</span></li>"
    );
  }

  function entryHtml(row) {
    return (
      '<a class="xm-home-entry" href="' +
      escapeHtml(row.href || "#") +
      '"><strong>' +
      escapeHtml(row.label || "") +
      "</strong><span>" +
      escapeHtml(row.hint || "") +
      "</span></a>"
    );
  }

  function helloText(user, greeting) {
    var now = chinaNow();
    var name = user && (user.displayName || user.username);
    var base = String(greeting || FALLBACK.greeting).replace(/[。.]?$/, "");
    if (name) {
      return greetWord(now.hour) + "，" + name + "。" + base + "。";
    }
    return base + "。";
  }

  function paint(root, state) {
    var cards = (state.cards && state.cards.length ? state.cards : FALLBACK.cards).map(function (card) {
      return Object.assign({}, card);
    });
    var themeCard = cards.find(function (card) {
      return card.key === "theme";
    });
    if (themeCard) {
      themeCard.value = themeName();
      themeCard.unit = "";
    }
    var queueCard = cards.find(function (card) {
      return card.key === "queue";
    });
    if (queueCard && state.queueCount != null) {
      queueCard.value = state.queueCount;
      queueCard.unit = "单";
    }
    var notices = state.notices && state.notices.length ? state.notices : FALLBACK.notices;
    var entries = state.entries && state.entries.length ? state.entries : FALLBACK.entries;
    var now = chinaNow();
    root.querySelector("#xm-home-hello").textContent = helloText(state.user, state.greeting);
    root.querySelector("#xm-home-date").textContent = now.date + " · " + now.weekday + " · 上海";
    root.querySelector("#xm-home-kpis").innerHTML = cards.map(cardHtml).join("");
    root.querySelector("#xm-home-notices").innerHTML = notices.map(noticeHtml).join("");
    root.querySelector("#xm-home-entries").innerHTML = entries.map(entryHtml).join("");
  }

  function setCard(root, key, value, unit) {
    var card = root.querySelector('[data-home-card="' + key + '"]');
    if (!card) {
      return;
    }
    var html = escapeHtml(value == null ? "—" : value);
    if (unit) {
      html += '<span class="unit">' + escapeHtml(unit) + "</span>";
    }
    card.querySelector(".value").innerHTML = html;
  }

  function api(path) {
    return fetch(path, {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    }).then(function (res) {
      if (res.status === 401) {
        window.location.href = "/login";
        return null;
      }
      if (!res.ok) {
        return null;
      }
      return res.json();
    });
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/home"] = {
    mount: function (root) {
      root.innerHTML =
        '<style id="xm-home-css">' +
        ".xm-home{display:flex;flex-direction:column;gap:12px}" +
        ".xm-home .page-head h1{margin:0;font-size:22px;color:var(--xm-ink)}" +
        ".xm-home-hello{margin:8px 0 0;font-size:15px;color:var(--xm-ink)}" +
        ".xm-home-date{margin:6px 0 0;font-size:13px;color:var(--xm-muted)}" +
        ".xm-home .kpi-grid{margin-bottom:0}" +
        ".xm-home .dash-bottom{align-items:stretch}" +
        ".xm-home .panel{min-height:0}" +
        ".xm-home .board-list li{align-items:flex-start;border-bottom-color:var(--xm-line)}" +
        ".xm-home .board-list .name{flex:0 0 88px;color:var(--xm-ink);font-weight:600}" +
        ".xm-home .board-list .hint{flex:1;color:var(--xm-muted);text-align:left}" +
        ".xm-home-entries{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
        ".xm-home-entry{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border:1px solid var(--xm-line);border-radius:8px;background:var(--xm-card);color:inherit;text-decoration:none}" +
        ".xm-home-entry:hover{border-color:var(--xm-primary);background:var(--xm-primary-soft)}" +
        ".xm-home-entry strong{color:var(--xm-ink);font-size:14px}" +
        ".xm-home-entry span{color:var(--xm-muted);font-size:12px}" +
        "@media (max-width:700px){.xm-home-entries{grid-template-columns:1fr}}" +
        "</style>" +
        '<main class="page xm-home">' +
        '<header class="page-head">' +
        "<h1>首页</h1>" +
        '<p class="xm-home-hello" id="xm-home-hello"></p>' +
        '<p class="xm-home-date" id="xm-home-date"></p>' +
        "</header>" +
        '<section class="kpi-grid" id="xm-home-kpis" aria-label="工作台指标"></section>' +
        '<div class="dash-bottom">' +
        '<section class="panel"><h2>今日关注</h2><ul class="board-list" id="xm-home-notices"></ul></section>' +
        '<section class="panel"><h2>常用入口</h2><div class="xm-home-entries" id="xm-home-entries"></div></section>' +
        "</div></main>";

      var dead = false;
      var state = {
        user: readUser(),
        greeting: FALLBACK.greeting,
        cards: FALLBACK.cards.map(function (card) {
          return Object.assign({}, card);
        }),
        notices: FALLBACK.notices,
        entries: FALLBACK.entries
      };
      paint(root, state);

      var timer = setInterval(function () {
        if (dead) {
          return;
        }
        var dateEl = root.querySelector("#xm-home-date");
        if (!dateEl) {
          return;
        }
        var now = chinaNow();
        dateEl.textContent = now.date + " · " + now.weekday + " · 上海";
      }, 1000);

      api("/api/home/summary").then(function (data) {
        if (dead || !data || data.ok !== true) {
          return;
        }
        state.greeting = data.greeting || state.greeting;
        if (data.cards && data.cards.length) {
          state.cards = data.cards;
        }
        if (data.notices && data.notices.length) {
          state.notices = data.notices;
        }
        if (data.entries && data.entries.length) {
          state.entries = data.entries;
        }
        paint(root, state);
      });

      if (!state.user || !state.user.username) {
        api("/api/auth/me").then(function (user) {
          if (dead || !user || !user.username) {
            return;
          }
          state.user = user;
          try {
            sessionStorage.setItem("xm-me", JSON.stringify(user));
          } catch (_err) {}
          paint(root, state);
        });
      }

      api("/api/releases/queue").then(function (data) {
        if (dead || !data) {
          return;
        }
        state.queueCount = Array.isArray(data.items) ? data.items.length : 0;
        setCard(root, "queue", state.queueCount, "单");
      });

      var themeWatch = new MutationObserver(function () {
        if (dead) {
          return;
        }
        setCard(root, "theme", themeName(), "");
      });
      themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      setCard(root, "theme", themeName(), "");

      return function unmount() {
        dead = true;
        clearInterval(timer);
        themeWatch.disconnect();
        root.innerHTML = "";
      };
    }
  };
  window.XmModules["/"] = window.XmModules["/home"];
})();
