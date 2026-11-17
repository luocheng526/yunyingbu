/* xm-module-academy 0.1.171 · dashboard */
(function () {
  const ASSET_VER = "0.1.171";
  const CSS_HREF = "/academy.css?v=" + ASSET_VER;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensureCss() {
    if (document.querySelector('link[href*="academy.css"]')) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CSS_HREF;
    document.head.appendChild(link);
  }

  function api(path) {
    return fetch(path, {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    }).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: "接口 " + res.status };
      }).then(function (data) {
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || "接口 " + res.status);
        }
        return data;
      });
    });
  }

  function stepsHtml(plan) {
    const steps = (plan && plan.steps) || [];
    return (
      '<ol class="academy-steps">' +
      steps
        .map(function (item) {
          return (
            '<li class="' +
            (item.current ? "is-on" : "") +
            '"><span class="academy-step-n">第 ' +
            escapeHtml(item.step) +
            " 步</span> " +
            escapeHtml(item.name) +
            "</li>"
          );
        })
        .join("") +
      "</ol>"
    );
  }

  function pageHead(title, lead, kicker) {
    return (
      '<header class="page-head"><p class="kicker">' +
      escapeHtml(kicker || "甄选商学院 · 第 2 步培训课程") +
      "</p><h1>" +
      escapeHtml(title) +
      "</h1><p class=\"lead\">" +
      escapeHtml(lead) +
      "</p></header>"
    );
  }

  function bootName() {
    const user = window.__xmBootUser || {};
    return user.displayName || user.username || "学员";
  }

  function watermarkText() {
    const now = new Date();
    const pad = function (n) {
      return String(n).padStart(2, "0");
    };
    const stamp =
      now.getFullYear() +
      "-" +
      pad(now.getMonth() + 1) +
      "-" +
      pad(now.getDate()) +
      " " +
      pad(now.getHours()) +
      ":" +
      pad(now.getMinutes());
    return bootName() + " · " + stamp;
  }

  function postForm(path, form) {
    return fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      body: form
    }).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: "接口 " + res.status };
      }).then(function (data) {
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || "接口 " + res.status);
        }
        return data;
      });
    });
  }

  function mountShell(root, html) {
    ensureCss();
    root.innerHTML = '<main class="page academy-page">' + html + "</main>";
    return function unmount() {
      root.innerHTML = "";
    };
  }

  function go(path) {
    if (window.location.pathname === path) {
      return;
    }
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function academyIcon(name) {
    const paths = {
      people: '<circle cx="12" cy="8" r="3"/><path d="M5 20c0-4 3-7 7-7s7 3 7 7M4 10a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6"/>',
      play: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m10 9 5 3-5 3Z"/>',
      paper: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h6m-6 4h6"/>',
      cap: '<path d="m3 10 9-5 9 5-9 5z"/><path d="M7 13v4c3 2 7 2 10 0v-4m4-3v6"/>',
      medal: '<circle cx="12" cy="9" r="5"/><path d="m9 14-2 7 5-3 5 3-2-7"/>',
      chart: '<path d="M4 20V9m5 11V4m5 16v-7m5 7V7"/><path d="m3 8 5-4 6 5 6-5"/>',
      book: '<path d="M4 5c4-1 6 1 8 3v12c-2-2-4-4-8-3zm16 0c-4-1-6 1-8 3v12c2-2 4-4 8-3z"/>',
      trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM5 5H3c0 4 2 6 5 6m11-6h2c0 4-2 6-5 6M12 13v4m-4 3h8m-6-3h4"/>',
      video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3Z"/>',
      chat: '<path d="M4 5h16v12H9l-5 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>',
      search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
      gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      file: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h6m-6 4h6"/>',
      folder: '<path d="M3 7h7l2 2h9v10H3z"/>',
      arrow: '<path d="m9 5 7 7-7 7"/>'
    };
    return (
      '<svg class="academy-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      (paths[name] || paths.paper) +
      "</svg>"
    );
  }

  function dashboardPage() {
    return {
      mount: function (root) {
        const metrics = [
          ["people", "在学人数", "50", "人", "blue"],
          ["play", "课程总数", "286", "门", "green"],
          ["paper", "题库数量", "1,240", "题", "blue"],
          ["cap", "本月考试", "12", "场", "purple"],
          ["medal", "待晋级", "8", "人", "orange"],
          ["chart", "学习完成率", "82%", "↑ +6%", "blue"]
        ];
        const quick = [
          ["play", "课程学习", "/academy/courses", "blue"],
          ["paper", "参加考试", "/academy/exams", "blue"],
          ["trophy", "职级晋升", "/academy/exams", "orange"],
          ["book", "运营手册", "/academy/handbook", "blue"],
          ["video", "培训视频", "/academy/courses", "purple"],
          ["chat", "知识问答", "#academy-search", "blue"]
        ];
        const courses = [
          ["新人必修", "京东店铺运营入门SOP", "2.4万人学习 · 12节", "60", "cart"],
          ["进阶提升", "京准通付费投放实战", "1.1万人学习 · 18节", "25", "trend"],
          ["数据分析", "商智数据分析与经营诊断", "8,736人学习 · 10节", "0", "bars"],
          ["选品策略", "爆款选品与测品方法论", "6,902人学习 · 14节", "80", "cube"]
        ];
        const handbookRows = [
          ["京东运营SOP（最新版 v3.2）", "file"],
          ["商品上架与优化标准流程", "file"],
          ["京准通投放操作手册", "file"],
          ["店铺日常运营检查清单", "file"],
          ["测品与拉新规则SOP", "file"]
        ];
        const knowledgeRows = [
          ["平台规则与政策", "120 篇"],
          ["运营方法论", "98 篇"],
          ["推广投放", "76 篇"],
          ["数据分析", "64 篇"],
          ["案例复盘", "52 篇"]
        ];
        const html =
          '<div class="academy-dashboard">' +
          '<header class="academy-home-head">' +
          '<div class="academy-home-brand"><span class="academy-logo-mark">' +
          academyIcon("cap") +
          '</span><div><h1>甄选商学院</h1><p>聚焦电商运营专业能力提升：新人培养 · 能力进阶 · 职级晋升 · 知识沉淀 · 团队成长</p></div></div>' +
          '<div class="academy-home-actions"><div class="academy-search-box">' +
          academyIcon("search") +
          '<input id="academy-search" autocomplete="off" placeholder="搜索课程、手册、知识、视频..." />' +
          '<div id="academy-search-results" class="academy-search-results" hidden></div></div>' +
          '<button type="button" class="academy-primary-btn" data-go="/academy/courses">' +
          academyIcon("plus") +
          " 上传资料</button>" +
          '<button type="button" class="academy-plain-btn" data-go="/academy/handbook">' +
          academyIcon("gear") +
          " 管理后台</button></div></header>" +
          '<section class="academy-metrics">' +
          metrics
            .map(function (item) {
              return (
                '<article class="academy-metric"><span class="academy-metric-icon is-' +
                item[4] +
                '">' +
                academyIcon(item[0]) +
                '</span><div><p>' +
                item[1] +
                "</p><strong>" +
                item[2] +
                "</strong><small>" +
                item[3] +
                "</small></div></article>"
              );
            })
            .join("") +
          "</section>" +
          '<section class="academy-hero-row"><div class="academy-hero-banner"><div><h2>甄选商学院</h2><p>让运营更专业 · 让成长更高效</p></div><div class="academy-hero-art"><span class="academy-screen">' +
          academyIcon("play") +
          '</span><i></i><i></i><i></i></div></div>' +
          '<div class="academy-quick-panel"><h2>快捷入口</h2><div class="academy-quick-grid">' +
          quick
            .map(function (item) {
              return (
                '<button type="button" data-go="' +
                item[2] +
                '"><span class="is-' +
                item[3] +
                '">' +
                academyIcon(item[0]) +
                "</span><b>" +
                item[1] +
                "</b></button>"
              );
            })
            .join("") +
          "</div></div></section>" +
          '<div class="academy-home-grid"><main class="academy-home-main">' +
          '<section class="academy-home-card academy-recommend"><div class="academy-section-head"><h2>推荐课程</h2>' +
          '<div class="academy-course-tabs"><button class="is-on" data-course-tab="all">新人必修</button><button data-course-tab="advanced">运营进阶</button><button data-course-tab="ads">付费推广</button><button data-course-tab="data">数据分析</button><button data-course-tab="shop">店铺运营</button><button data-course-tab="manage">管理提升</button></div>' +
          '<button class="academy-link" data-go="/academy/courses">查看全部 ' +
          academyIcon("arrow") +
          "</button></div><div class=\"academy-recommend-grid\">" +
          courses
            .map(function (item, index) {
              return (
                '<button type="button" class="academy-recommend-item" data-go="/academy/courses" data-course-kind="' +
                (index ? "advanced" : "all") +
                '"><span class="academy-course-cover cover-' +
                item[4] +
                '"><em>' +
                item[0] +
                '</em><i class="shape-one"></i><i class="shape-two"></i></span><b>' +
                item[1] +
                '</b><small>' +
                item[2] +
                '</small><span class="academy-progress"><i style="width:' +
                item[3] +
                '%"></i></span><small class="academy-progress-label">已学 ' +
                item[3] +
                "%</small></button>"
              );
            })
            .join("") +
          "</div></section>" +
          '<div class="academy-library-grid"><section class="academy-home-card"><div class="academy-section-head"><h2>运营手册（SOP）</h2><button class="academy-link" data-go="/academy/handbook">查看全部 ' +
          academyIcon("arrow") +
          '</button></div><div id="academy-handbook-list" class="academy-list">' +
          handbookRows
            .map(function (item) {
              return (
                '<button type="button" data-go="/academy/handbook"><span class="academy-list-icon is-blue">' +
                academyIcon(item[1]) +
                "</span><b>" +
                item[0] +
                '</b><span class="academy-download">↓</span></button>'
              );
            })
            .join("") +
          '</div></section><section class="academy-home-card"><div class="academy-section-head"><h2>运营知识库</h2><button class="academy-link" data-focus-search="1">查看全部 ' +
          academyIcon("arrow") +
          '</button></div><div id="academy-knowledge-list" class="academy-list">' +
          knowledgeRows
            .map(function (item) {
              return (
                '<button type="button" data-search="' +
                item[0] +
                '"><span class="academy-list-icon is-orange">' +
                academyIcon("folder") +
                "</span><b>" +
                item[0] +
                "</b><small>" +
                item[1] +
                "</small></button>"
              );
            })
            .join("") +
          "</div></section></div></main>" +
          '<aside class="academy-home-side"><section class="academy-home-card academy-learning"><div class="academy-section-head"><h2>我的学习</h2><button class="academy-link" data-go="/academy/courses">学习进度 ' +
          academyIcon("arrow") +
          '</button></div><div class="academy-learning-body"><div class="academy-ring"><div><strong>82%</strong><span>本月学习完成率</span></div></div>' +
          '<ul><li><span class="dot done">✓</span>已完成课程 <b>14 门</b></li><li><span class="dot clock">◷</span>学习时长 <b>32.5 小时</b></li><li><span class="dot play">▷</span>在学课程 <b>4 门</b></li><li><span class="dot exam">▣</span>待考试 <b>1 场</b></li></ul></div></section>' +
          '<section class="academy-home-card academy-promotion"><div class="academy-section-head"><h2>职级晋升</h2><button class="academy-link" data-go="/academy/exams">查看体系 ' +
          academyIcon("arrow") +
          '</button></div><div class="academy-levels"><div class="done"><i>✓</i><b>运营助理</b><small>Lv1</small></div><div class="done"><i>✓</i><b>运营专员</b><small>Lv2</small></div><div class="current"><em>当前</em><i>—</i><b>运营主管</b><small>Lv3</small></div><div><i>●</i><b>运营经理</b><small>Lv4</small></div><div><i>●</i><b>运营总监</b><small>Lv5</small></div></div>' +
          '<div class="academy-promotion-box"><h3>晋升条件（运营主管 Lv3）</h3><div><p>✓　通过职级考试（≥80分）</p><p>✓　完成必修课程（10/10）</p><p>○　近3个月利润达成 ≥100万</p><p>○　团队管理考核</p></div><button type="button" data-go="/academy/exams">申请晋升</button></div></section></aside></div>' +
          "</div>";
        const unmount = mountShell(root, html);
        let dead = false;
        let searchTimer = 0;

        function fillFromApi() {
          Promise.all([
            api("/api/academy").catch(function () { return {}; }),
            api("/api/academy/courses").catch(function () { return {}; }),
            api("/api/academy/progress").catch(function () { return {}; })
          ]).then(function (values) {
            if (dead) {
              return;
            }
            const catalog = values[0] || {};
            const list = values[1] || {};
            const progress = values[2] || {};
            const metricValues = root.querySelectorAll(".academy-metric strong");
            if (metricValues[1] && (list.items || []).length) {
              metricValues[1].textContent = String((list.items || []).length);
            }
            const done = (progress.progress || []).filter(function (item) { return item.done; }).length;
            if (done && metricValues[5]) {
              metricValues[5].textContent = Math.min(100, Math.round((done / Math.max(done, (catalog.docs || []).length)) * 100)) + "%";
            }
          });
        }

        function showSearch(query) {
          const box = root.querySelector("#academy-search-results");
          if (!query) {
            box.hidden = true;
            box.innerHTML = "";
            return;
          }
          api("/api/academy/search?q=" + encodeURIComponent(query))
            .then(function (data) {
              if (dead) {
                return;
              }
              const hits = data.hits || [];
              box.innerHTML = hits.length
                ? hits
                    .slice(0, 6)
                    .map(function (item) {
                      return '<button type="button" data-go="/academy/handbook"><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.category) + "</small></button>";
                    })
                    .join("")
                : '<p>没有找到相关内容</p>';
              box.hidden = false;
            })
            .catch(function () {
              box.hidden = true;
            });
        }

        root.addEventListener("click", function (ev) {
          const target = ev.target.closest("[data-go]");
          if (target) {
            const path = target.getAttribute("data-go");
            if (path && path.charAt(0) === "#") {
              const input = root.querySelector(path);
              if (input) {
                input.focus();
              }
            } else if (path) {
              go(path);
            }
            return;
          }
          const search = ev.target.closest("[data-search]");
          if (search) {
            const input = root.querySelector("#academy-search");
            input.value = search.getAttribute("data-search");
            input.focus();
            showSearch(input.value);
            return;
          }
          if (ev.target.closest("[data-focus-search]")) {
            root.querySelector("#academy-search").focus();
          }
        });
        root.querySelector("#academy-search").addEventListener("input", function (ev) {
          window.clearTimeout(searchTimer);
          const query = ev.target.value.trim();
          searchTimer = window.setTimeout(function () {
            showSearch(query);
          }, 180);
        });
        root.querySelectorAll("[data-course-tab]").forEach(function (button) {
          button.addEventListener("click", function () {
            root.querySelectorAll("[data-course-tab]").forEach(function (item) {
              item.classList.toggle("is-on", item === button);
            });
            const kind = button.getAttribute("data-course-tab");
            root.querySelectorAll(".academy-recommend-item").forEach(function (card, index) {
              card.hidden = kind !== "all" && card.getAttribute("data-course-kind") !== kind && index > 1;
            });
          });
        });
        fillFromApi();
        return function () {
          dead = true;
          window.clearTimeout(searchTimer);
          unmount();
        };
      }
    };
  }

  function coursesPage() {
    return {
      mount: function (root) {
        const unmount = mountShell(
          root,
          pageHead(
            "培训课程",
            "导入运营 PPTX。原件不提供下载，只能在线翻页。预览页带姓名和时间水印。"
          ) +
            '<div id="academy-plan"></div>' +
            '<section class="panel academy-drop">' +
            "<h2>导入 PPT</h2>" +
            '<p class="academy-meta">只接受 .pptx。旧版 .ppt 请另存。不提供原件下载。</p>' +
            '<form id="academy-upload" class="academy-upload">' +
            '<label>标题 <input name="title" required maxlength="160" placeholder="课件标题" /></label>' +
            '<label>分类 <select name="category">' +
            '<option value="选品与商品">选品与商品</option>' +
            '<option value="流量与投放">流量与投放</option>' +
            '<option value="转化与页面">转化与页面</option>' +
            '<option value="数据与复盘">数据与复盘</option>' +
            '<option value="大促节奏">大促节奏</option>' +
            "</select></label>" +
            '<label class="academy-check"><input type="checkbox" name="published" checked /> 发布</label>' +
            '<label class="academy-file">课件 <input type="file" name="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" required /></label>' +
            '<button type="submit">上传</button>' +
            '<p class="academy-status" id="academy-upload-status"></p>' +
            "</form>" +
            "</section>" +
            '<div class="academy-layout">' +
            '<section class="panel"><h2>课件列表</h2><div class="academy-course-list" id="academy-course-list"></div></section>' +
            '<section class="panel academy-viewer-panel" id="academy-viewer"><h2>在线翻页</h2><p class="academy-empty">点左侧一份课件。</p></section>' +
            "</div>"
        );
        let dead = false;
        let currentId = "";
        let pageCount = 0;
        let pageNo = 1;

        function renderList(items) {
          const box = root.querySelector("#academy-course-list");
          if (!items || !items.length) {
            box.innerHTML = '<p class="academy-empty">还没有课件。上传 PPTX 后出现在这里。</p>';
            return;
          }
          box.innerHTML = items
            .map(function (item) {
              return (
                '<button type="button" class="academy-course' +
                (item.id === currentId ? " is-on" : "") +
                '" data-id="' +
                escapeHtml(item.id) +
                '"><h3>' +
                escapeHtml(item.title) +
                '</h3><p class="academy-meta">' +
                escapeHtml(item.category) +
                " · " +
                escapeHtml(item.pageCount) +
                " 页 · " +
                (item.published ? "已发布" : "草稿") +
                "</p></button>"
              );
            })
            .join("");
        }

        function loadList() {
          return api("/api/academy/courses").then(function (data) {
            if (!dead) {
              renderList(data.items || []);
            }
            return data;
          });
        }

        function paintPage(data) {
          const panel = root.querySelector("#academy-viewer");
          const page = data.page || {};
          const texts = (page.texts || [])
            .map(function (line) {
              return "<p>" + escapeHtml(line) + "</p>";
            })
            .join("");
          const images = (page.images || [])
            .map(function (img) {
              return (
                '<img src="' +
                escapeHtml(img.url) +
                '" alt="" draggable="false" />'
              );
            })
            .join("");
          const mark = watermarkText();
          const tiles = new Array(24).fill(escapeHtml(mark)).join(" ");
          panel.innerHTML =
            "<h2>" +
            escapeHtml(data.title || "在线翻页") +
            "</h2>" +
            '<p class="academy-meta">第 ' +
            escapeHtml(page.index) +
            " / " +
            escapeHtml(data.pageCount) +
            " 页 · 不可下载原件</p>" +
            '<div class="academy-viewer" id="academy-slide">' +
            '<div class="academy-slide-body">' +
            (images || "") +
            (texts || '<p class="academy-empty">本页没有可提取的文字</p>') +
            "</div>" +
            '<div class="academy-wm" aria-hidden="true">' +
            tiles +
            "</div></div>" +
            '<div class="academy-actions">' +
            '<button type="button" class="ghost" data-nav="-1">上一页</button>' +
            '<button type="button" data-nav="1">下一页</button>' +
            "</div>";
        }

        function openPage(id, index) {
          api("/api/academy/courses/" + encodeURIComponent(id) + "/pages/" + encodeURIComponent(index))
            .then(function (data) {
              if (dead) {
                return;
              }
              currentId = id;
              pageCount = Number(data.pageCount) || 1;
              pageNo = Number((data.page && data.page.index) || index);
              paintPage(data);
              root.querySelectorAll(".academy-course").forEach(function (el) {
                el.classList.toggle("is-on", el.getAttribute("data-id") === id);
              });
            })
            .catch(function (err) {
              root.querySelector("#academy-viewer").innerHTML =
                '<h2>在线翻页</h2><p class="academy-status error">' + escapeHtml(err.message) + "</p>";
            });
        }

        api("/api/academy/plan")
          .then(function (data) {
            const el = root.querySelector("#academy-plan");
            if (!dead && el) {
              el.innerHTML = stepsHtml(data);
            }
          })
          .catch(function () {});
        loadList().catch(function (err) {
          const box = root.querySelector("#academy-course-list");
          if (box) {
            box.innerHTML = '<p class="academy-status error">' + escapeHtml(err.message) + "</p>";
          }
        });

        root.querySelector("#academy-upload").addEventListener("submit", function (ev) {
          ev.preventDefault();
          const formEl = ev.currentTarget;
          const status = root.querySelector("#academy-upload-status");
          const fileInput = formEl.querySelector('input[type="file"]');
          const file = fileInput && fileInput.files && fileInput.files[0];
          if (file && /\.ppt$/i.test(file.name) && !/\.pptx$/i.test(file.name)) {
            status.textContent = "请另存为 .pptx 再上传（不支持旧版 .ppt）";
            status.className = "academy-status error";
            return;
          }
          const fd = new FormData();
          fd.append("title", formEl.title.value);
          fd.append("category", formEl.category.value);
          fd.append("published", formEl.published.checked ? "true" : "false");
          if (file) {
            fd.append("file", file, file.name);
          }
          status.textContent = "正在解析…";
          status.className = "academy-status";
          postForm("/api/academy/courses", fd)
            .then(function (data) {
              status.textContent = "已导入，学员只能在线翻页。";
              formEl.reset();
              formEl.published.checked = true;
              return loadList().then(function () {
                if (data.course && data.course.id) {
                  openPage(data.course.id, 1);
                }
              });
            })
            .catch(function (err) {
              status.textContent = err.message;
              status.className = "academy-status error";
            });
        });

        root.querySelector("#academy-course-list").addEventListener("click", function (ev) {
          const btn = ev.target.closest("[data-id]");
          if (!btn) {
            return;
          }
          openPage(btn.getAttribute("data-id"), 1);
        });

        root.querySelector("#academy-viewer").addEventListener("click", function (ev) {
          const btn = ev.target.closest("[data-nav]");
          if (!btn || !currentId) {
            return;
          }
          const next = pageNo + Number(btn.getAttribute("data-nav"));
          if (next < 1 || next > pageCount) {
            return;
          }
          openPage(currentId, next);
        });

        root.addEventListener("contextmenu", function (ev) {
          if (ev.target.closest(".academy-viewer")) {
            ev.preventDefault();
          }
        });
        root.addEventListener("dragstart", function (ev) {
          if (ev.target.closest(".academy-viewer")) {
            ev.preventDefault();
          }
        });

        return function () {
          dead = true;
          unmount();
        };
      }
    };
  }

  function examsPage() {
    return {
      mount: function (root) {
        const unmount = mountShell(
          root,
          pageHead(
            "培训考试",
            "先选晋升档，再出卷。本步只把六档和限时架子搭好，题目下一步再写。"
          ) +
            '<div id="academy-plan"></div>' +
            '<section class="kpi-grid academy-exam-grid" id="academy-tracks" aria-label="考试档"></section>' +
            '<section class="panel" id="academy-paper"><h2>试卷</h2><p class="academy-empty">先点上面一档。</p></section>'
        );
        let dead = false;
        api("/api/academy/plan")
          .then(function (data) {
            const el = root.querySelector("#academy-plan");
            if (!dead && el) {
              el.innerHTML = stepsHtml(data);
            }
          })
          .catch(function () {});
        api("/api/academy/exams/tracks")
          .then(function (data) {
            if (dead) {
              return;
            }
            const box = root.querySelector("#academy-tracks");
            box.innerHTML = (data.tracks || [])
              .map(function (track) {
                return (
                  '<button type="button" class="kpi-card academy-track" data-id="' +
                  escapeHtml(track.id) +
                  '"><div class="label">' +
                  escapeHtml(track.from) +
                  " → " +
                  escapeHtml(track.to) +
                  '</div><div class="value">' +
                  escapeHtml(track.name) +
                  '</div><p class="academy-meta">' +
                  escapeHtml(track.minutes) +
                  " 分钟 · " +
                  escapeHtml(track.questions) +
                  " 题 · " +
                  escapeHtml(track.passScore) +
                  " 分及格</p></button>"
                );
              })
              .join("");
          })
          .catch(function (err) {
            const box = root.querySelector("#academy-tracks");
            if (box) {
              box.innerHTML = '<p class="academy-status error">' + escapeHtml(err.message) + "</p>";
            }
          });
        root.querySelector("#academy-tracks").addEventListener("click", function (ev) {
          const btn = ev.target.closest("[data-id]");
          if (!btn) {
            return;
          }
          const id = btn.getAttribute("data-id");
          root.querySelectorAll(".academy-track").forEach(function (el) {
            el.classList.toggle("is-on", el.getAttribute("data-id") === id);
          });
          const paper = root.querySelector("#academy-paper");
          paper.innerHTML = "<h2>试卷</h2><p class=\"academy-empty\">正在打开这一档…</p>";
          api("/api/academy/exams/tracks/" + encodeURIComponent(id))
            .then(function (data) {
              if (dead) {
                return;
              }
              const track = data.track || {};
              paper.innerHTML =
                "<h2>" +
                escapeHtml(track.name) +
                '</h2><p class="academy-meta">规定时间 ' +
                escapeHtml(track.minutes) +
                " 分钟 · 到点交卷 · 第 3 步才写入题目</p>" +
                '<div class="academy-timer" aria-live="polite">剩余 ' +
                escapeHtml(track.minutes) +
                " : 00（本步不倒计时）</div>" +
                '<p class="academy-empty">题目区空着。下一步按这一档出选择题。</p>';
            })
            .catch(function (err) {
              paper.innerHTML = '<h2>试卷</h2><p class="academy-status error">' + escapeHtml(err.message) + "</p>";
            });
        });
        return function () {
          dead = true;
          unmount();
        };
      }
    };
  }

  function handbookPage() {
    return {
      mount: function (root) {
        const unmount = mountShell(
          root,
          pageHead(
            "运营手册",
            "一节一节分开。下一步才在网页里写正文、加分支、插图。现在只放章节树。"
          ) +
            '<div id="academy-plan"></div>' +
            '<div class="academy-layout">' +
            '<section class="panel"><h2>章节</h2><nav class="academy-tree" id="academy-tree"></nav></section>' +
            '<section class="panel" id="academy-section"><h2>本节</h2><p class="academy-empty">点左侧一节。编辑、插图下一步再开。</p></section>' +
            "</div>"
        );
        let dead = false;
        api("/api/academy/plan")
          .then(function (data) {
            const el = root.querySelector("#academy-plan");
            if (!dead && el) {
              el.innerHTML = stepsHtml(data);
            }
          })
          .catch(function () {});
        api("/api/academy/handbook/tree")
          .then(function (data) {
            if (dead) {
              return;
            }
            const tree = root.querySelector("#academy-tree");
            tree.innerHTML = (data.tree || [])
              .map(function (node) {
                const kids = (node.children || [])
                  .map(function (child) {
                    return (
                      '<button type="button" class="academy-tree-item" data-id="' +
                      escapeHtml(child.id) +
                      '" data-title="' +
                      escapeHtml(child.title) +
                      '">' +
                      escapeHtml(child.title) +
                      "</button>"
                    );
                  })
                  .join("");
                return (
                  '<div class="academy-tree-group"><p class="academy-tree-parent">' +
                  escapeHtml(node.title) +
                  "</p>" +
                  kids +
                  "</div>"
                );
              })
              .join("");
          })
          .catch(function (err) {
            const tree = root.querySelector("#academy-tree");
            if (tree) {
              tree.innerHTML = '<p class="academy-status error">' + escapeHtml(err.message) + "</p>";
            }
          });
        root.querySelector("#academy-tree").addEventListener("click", function (ev) {
          const btn = ev.target.closest("[data-id]");
          if (!btn) {
            return;
          }
          root.querySelectorAll(".academy-tree-item").forEach(function (el) {
            el.classList.toggle("is-on", el === btn);
          });
          const title = btn.getAttribute("data-title") || "";
          root.querySelector("#academy-section").innerHTML =
            "<h2>" +
            escapeHtml(title) +
            '</h2><p class="academy-meta">本节还没有正文。第 4 步在网页里写、可加下级分支和图片。</p>' +
            '<div class="academy-doc-shell" aria-disabled="true"><p class="academy-empty">文档编辑区（下一步）</p></div>';
        });
        return function () {
          dead = true;
          unmount();
        };
      }
    };
  }

  window.XmModules = window.XmModules || {};
  const courses = coursesPage();
  window.XmModules["/academy"] = dashboardPage();
  window.XmModules["/academy/courses"] = courses;
  window.XmModules["/academy/exams"] = examsPage();
  window.XmModules["/academy/handbook"] = handbookPage();
})();
