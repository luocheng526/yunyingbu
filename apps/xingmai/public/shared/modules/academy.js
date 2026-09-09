/* xm-module-academy 0.1.160 */
(function () {
  const ASSET_VER = "0.1.160";
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

  function pageHead(title, lead) {
    return (
      '<header class="page-head"><p class="kicker">甄选商学院 · 第 1 步框架</p><h1>' +
      escapeHtml(title) +
      "</h1><p class=\"lead\">" +
      escapeHtml(lead) +
      "</p></header>"
    );
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
            "只放运营 PPT。下一步才开导入：能上传，不能下载原件，截图带水印。现在先把架子摆出来。"
          ) +
            '<div id="academy-plan"></div>' +
            '<section class="panel academy-drop">' +
            "<h2>导入 PPT（下一步）</h2>" +
            '<p class="academy-meta">支持 .ppt / .pptx。原文件不提供下载。预览页会加水印。</p>' +
            '<label class="academy-file"><input type="file" accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" disabled />选择课件（本步未开放）</label>' +
            "</section>" +
            '<section class="panel"><h2>课件列表</h2><p class="academy-empty" id="academy-course-empty">还没有课件。第 2 步导入后出现在这里，学员只能在线翻页。</p></section>'
        );
        api("/api/academy/plan")
          .then(function (data) {
            const el = root.querySelector("#academy-plan");
            if (el) {
              el.innerHTML = stepsHtml(data);
            }
          })
          .catch(function () {});
        return unmount;
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
