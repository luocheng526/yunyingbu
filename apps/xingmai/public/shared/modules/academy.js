/* xm-module-academy 0.1.170 */
(function () {
  const ASSET_VER = "0.1.170";
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
  window.XmModules["/academy"] = courses;
  window.XmModules["/academy/courses"] = courses;
  window.XmModules["/academy/exams"] = examsPage();
  window.XmModules["/academy/handbook"] = handbookPage();
})();
