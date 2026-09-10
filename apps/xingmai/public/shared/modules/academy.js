/* xm-module-academy 0.1.217 */
(function () {
  const ASSET_VER = "0.1.217";
  const CSS_HREF = "/academy.css?v=" + ASSET_VER;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensureCss() {
    const links = document.querySelectorAll('link[href*="academy.css"]');
    let fresh = false;
    Array.prototype.forEach.call(links, function (link) {
      if (String(link.getAttribute("href") || "").indexOf("v=" + ASSET_VER) >= 0) {
        fresh = true;
      } else {
        link.parentNode.removeChild(link);
      }
    });
    if (fresh) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CSS_HREF;
    document.head.appendChild(link);
  }

  function fillLogs(box) {
    box.innerHTML = '<p class="academy-empty">正在读取…</p>';
    api("/api/academy/logs")
      .then(function (data) {
        const items = data.items || [];
        if (!items.length) {
          box.innerHTML = '<p class="academy-empty">还没有操作。</p>';
          return;
        }
        box.innerHTML =
          '<table class="academy-log"><thead><tr><th>时间</th><th>谁</th><th>动作</th><th>对象</th><th>说明</th></tr></thead><tbody>' +
          items
            .map(function (item) {
              return (
                "<tr><td>" +
                escapeHtml(item.at) +
                "</td><td>" +
                escapeHtml(item.actorName || item.actor) +
                "</td><td>" +
                escapeHtml(item.action) +
                "</td><td>" +
                escapeHtml(item.sectionTitle || item.sectionId) +
                "</td><td>" +
                escapeHtml(item.detail) +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table>";
      })
      .catch(function (err) {
        box.innerHTML = '<p class="academy-status error">' + escapeHtml(err.message) + "</p>";
      });
  }

  function apiError(res, data) {
    if (res.status === 401) {
      return "登录已失效，请刷新后再试";
    }
    if (res.status === 413) {
      return "文件被网关拦截，请到「文件上传」分片上传";
    }
    return (data && data.error) || "接口 " + res.status;
  }

  function api(path) {
    return fetch(path, {
      credentials: "include",
      headers: { Accept: "application/json" }
    }).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: apiError(res, null) };
      }).then(function (data) {
        if (!res.ok || data.ok === false) {
          throw new Error(apiError(res, data));
        }
        return data;
      });
    });
  }

  function pageHead(title, lead) {
    return (
      '<header class="page-head academy-head"><h1>' +
      escapeHtml(title) +
      "</h1>" +
      (lead ? '<p class="lead">' + escapeHtml(lead) + "</p>" : "") +
      "</header>"
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

  function postJson(path, body) {
    return fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: apiError(res, null) };
      }).then(function (data) {
        if (!res.ok || data.ok === false) {
          throw new Error(apiError(res, data));
        }
        return data;
      });
    });
  }

  function postForm(path, form) {
    return fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
      body: form
    }).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: apiError(res, null) };
      }).then(function (data) {
        if (!res.ok || data.ok === false) {
          throw new Error(apiError(res, data));
        }
        return data;
      });
    });
  }

  function postCourseFile(formEl, file, onProgress) {
    const chunkSize = 128 * 1024;
    const uploadId =
      window.crypto && crypto.randomUUID ? crypto.randomUUID() : "u" + String(Date.now());
    const total = Math.max(1, Math.ceil((file && file.size ? file.size : 0) / chunkSize));
    function send(index) {
      if (onProgress) {
        onProgress(index + 1, total);
      }
      const start = index * chunkSize;
      const blob = file ? file.slice(start, start + chunkSize) : new Blob();
      const qs = new URLSearchParams();
      qs.set("uploadId", uploadId);
      qs.set("index", String(index));
      qs.set("total", String(total));
      qs.set("size", String(file && file.size ? file.size : 0));
      qs.set("title", formEl.title.value);
      qs.set("category", formEl.category.value);
      qs.set("published", formEl.published.checked ? "1" : "0");
      qs.set("filename", file && file.name ? file.name : "course.pptx");
      return fetch("/api/academy/courses/chunk?" + qs.toString(), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/octet-stream"
        },
        body: blob
      }).then(function (res) {
        return res
          .json()
          .catch(function () {
            return { ok: false, error: apiError(res, null) };
          })
          .then(function (data) {
            if (!res.ok || data.ok === false) {
              throw new Error(apiError(res, data));
            }
            if (data.pending && index + 1 < total) {
              return send(index + 1);
            }
            return data;
          });
      });
    }
    return send(0);
  }

  function stripLogMenu() {
    const menus = document.querySelectorAll(".xm-menu a, .xm-submenu a");
    Array.prototype.forEach.call(menus, function (el) {
      const label = String(el.textContent || "").replace(/\s+/g, "");
      if (label === "操作日志") {
        el.remove();
      }
    });
  }

  function watchLogMenu() {
    stripLogMenu();
    if (watchLogMenu.bound) {
      return;
    }
    watchLogMenu.bound = true;
    const host = document.querySelector(".xm-menu") || document.body;
    const mo = new MutationObserver(function () {
      stripLogMenu();
    });
    mo.observe(host, { childList: true, subtree: true });
  }

  function mountShell(root, html) {
    ensureCss();
    watchLogMenu();
    root.innerHTML = '<main class="page academy-page academy-live academy-console-page">' + html + "</main>";
    return function unmount() {
      root.innerHTML = "";
    };
  }

  function consoleFrame(inner, tabs) {
    const tabHtml = (tabs || [])
      .map(function (tab) {
        return (
          '<button type="button" class="academy-tab" id="' +
          escapeHtml(tab.id) +
          '">' +
          escapeHtml(tab.label) +
          "</button>"
        );
      })
      .join("");
    return (
      '<div class="academy-console">' +
      '<div class="academy-console-top">' +
      '<button type="button" class="academy-brand" id="academy-brand">星脉甄选商学院</button>' +
      (tabHtml ? '<nav class="academy-console-tabs">' + tabHtml + "</nav>" : "") +
      "</div>" +
      inner +
      "</div>"
    );
  }

  function uploadPaneHtml() {
    return (
      '<div class="academy-console-stage" id="academy-view-upload" hidden>' +
      '<form id="academy-upload" class="academy-toolbar">' +
      '<label>标题 <input name="title" required maxlength="160" placeholder="课件标题" /></label>' +
      '<label>分类 <select name="category">' +
      '<option value="选品与商品">选品与商品</option>' +
      '<option value="流量与投放">流量与投放</option>' +
      '<option value="转化与页面">转化与页面</option>' +
      '<option value="数据与复盘">数据与复盘</option>' +
      '<option value="大促节奏">大促节奏</option>' +
      "</select></label>" +
      '<label><input type="checkbox" name="published" checked /> 发布</label>' +
      '<label>课件 <input type="file" name="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" required /></label>' +
      '<button type="submit">上传</button>' +
      "</form>" +
      '<p class="academy-status" id="academy-upload-status"></p>' +
      "</div>" +
      '<div id="academy-log-box" class="academy-console-logs" hidden></div>'
    );
  }

  function chromeTabs() {
    return [
      { id: "academy-tab-upload", label: "文件上传" },
      { id: "academy-open-logs", label: "操作日志" }
    ];
  }

  function bindAcademyChrome(root, homeId, afterUpload) {
    function showView(name) {
      const home = root.querySelector("#" + homeId);
      const uploadBox = root.querySelector("#academy-view-upload");
      const logBox = root.querySelector("#academy-log-box");
      const uploadTab = root.querySelector("#academy-tab-upload");
      const logTab = root.querySelector("#academy-open-logs");
      if (home) {
        home.hidden = name !== "home";
      }
      if (uploadBox) {
        uploadBox.hidden = name !== "upload";
      }
      if (logBox) {
        logBox.hidden = name !== "logs";
      }
      if (uploadTab) {
        uploadTab.classList.toggle("is-on", name === "upload");
      }
      if (logTab) {
        logTab.classList.toggle("is-on", name === "logs");
      }
      if (name === "logs" && logBox) {
        fillLogs(logBox);
      }
    }
    const brand = root.querySelector("#academy-brand");
    if (brand) {
      brand.addEventListener("click", function () {
        showView("home");
      });
    }
    const uploadTab = root.querySelector("#academy-tab-upload");
    if (uploadTab) {
      uploadTab.addEventListener("click", function () {
        showView("upload");
      });
    }
    const logTab = root.querySelector("#academy-open-logs");
    if (logTab) {
      logTab.addEventListener("click", function () {
        showView("logs");
      });
    }
    const form = root.querySelector("#academy-upload");
    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        const status = root.querySelector("#academy-upload-status");
        const fileInput = form.querySelector('input[type="file"]');
        const file = fileInput && fileInput.files && fileInput.files[0];
        if (file && /\.ppt$/i.test(file.name) && !/\.pptx$/i.test(file.name)) {
          status.textContent = "请另存为 .pptx 再上传（不支持旧版 .ppt）";
          status.className = "academy-status error";
          return;
        }
        status.textContent = "正在上传…";
        status.className = "academy-status";
        postCourseFile(form, file, function (got, total) {
          status.textContent = "正在上传 " + got + "/" + total;
        })
          .then(function (data) {
            status.textContent = "已导入，学员只能在线翻页。";
            form.reset();
            form.published.checked = true;
            showView("home");
            if (afterUpload) {
              afterUpload(data);
            }
          })
          .catch(function (err) {
            status.textContent = err.message;
            status.className = "academy-status error";
          });
      });
    }
    return showView;
  }

  function canEditHandbook() {
    const user = window.__xmBootUser || {};
    const names = [user.username, user.displayName];
    return names.some(function (name) {
      return name === "罗成" || name === "沈子晗" || name === "韩梦凯";
    });
  }

  function coursesPage() {
    return {
      mount: function (root) {
        const unmount = mountShell(
          root,
          consoleFrame(
            '<div class="academy-console-stage" id="academy-view-courses">' +
              '<div class="academy-work" id="academy-work">' +
              '<aside class="academy-side"><div class="academy-course-list" id="academy-course-list"></div></aside>' +
              '<section class="academy-main" id="academy-viewer" hidden></section>' +
              "</div></div>" +
              uploadPaneHtml(),
            chromeTabs()
          )
        );
        let dead = false;
        let currentId = "";
        let pageCount = 0;
        let pageNo = 1;
        const showView = bindAcademyChrome(root, "academy-view-courses", function (data) {
          loadList().then(function () {
            if (data.course && data.course.id) {
              openPage(data.course.id, 1);
            }
          });
        });

        function renderList(items) {
          const box = root.querySelector("#academy-course-list");
          if (!items || !items.length) {
            box.innerHTML = '<p class="academy-empty">还没有课件。到「文件上传」导入 PPTX。不提供原件下载。</p>';
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
          const work = root.querySelector("#academy-work");
          const panel = root.querySelector("#academy-viewer");
          panel.hidden = false;
          if (work) {
            work.classList.add("has-viewer");
          }
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
              root.querySelector("#academy-viewer").hidden = false;
              root.querySelector("#academy-viewer").innerHTML =
                '<h2>在线翻页</h2><p class="academy-status error">' + escapeHtml(err.message) + "</p>";
            });
        }

        loadList().catch(function (err) {
          const box = root.querySelector("#academy-course-list");
          if (box) {
            box.innerHTML = '<p class="academy-status error">' + escapeHtml(err.message) + "</p>";
          }
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
          consoleFrame(
            '<div class="academy-exam-shell" id="academy-view-exams">' +
              '<aside class="academy-exam-side"><nav class="academy-tracks" id="academy-tracks" aria-label="考试档"></nav></aside>' +
              '<section class="academy-exam-main academy-exam-detail" id="academy-exam-detail">' +
              '<div class="academy-board" id="academy-paper">' +
              '<div class="academy-board-head"><h2>考试内容</h2></div>' +
              '<p class="academy-empty">点左侧一档，导入文档或开始考试。</p></div></section></div>' +
              uploadPaneHtml(),
            chromeTabs()
          )
        );
        let dead = false;
        let trackId = "";
        let timer = null;
        let remain = 0;
        let ticking = false;
        bindAcademyChrome(root, "academy-view-exams");

        function stopTimer() {
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
          ticking = false;
        }

        function clock(seconds) {
          const m = Math.floor(Math.max(0, seconds) / 60);
          const s = Math.max(0, seconds) % 60;
          return String(m).padStart(2, "0") + " : " + String(s).padStart(2, "0");
        }

        function showHome() {
          stopTimer();
          trackId = "";
          root.querySelectorAll(".academy-track").forEach(function (el) {
            el.classList.remove("is-on");
          });
          const paper = root.querySelector("#academy-paper");
          if (paper) {
            paper.innerHTML =
              '<div class="academy-board-head"><h2>考试内容</h2></div>' +
              '<p class="academy-empty">点左侧一档，导入文档或开始考试。</p>';
          }
        }

        function collectAnswers() {
          const answers = {};
          root.querySelectorAll(".academy-q").forEach(function (box) {
            const index = box.getAttribute("data-index");
            const hit = box.querySelector("input:checked");
            if (index && hit) {
              answers[index] = hit.value;
            }
          });
          return answers;
        }

        function renderTracks(tracks) {
          const box = root.querySelector("#academy-tracks");
          box.innerHTML = (tracks || [])
            .map(function (track) {
              return (
                '<button type="button" class="academy-track' +
                (track.id === trackId ? " is-on" : "") +
                '" data-id="' +
                escapeHtml(track.id) +
                '"><div class="label">' +
                escapeHtml(track.from) +
                " → " +
                escapeHtml(track.to) +
                '</div><div class="value">' +
                escapeHtml(track.name) +
                '</div><p class="academy-meta">' +
                escapeHtml(track.minutes) +
                " 分钟 · 及格 " +
                escapeHtml(track.passScore) +
                " 分" +
                (track.paperReady ? " · 已导入 " + escapeHtml(track.importedQuestions) + " 题" : " · 待导入") +
                "</p></button>"
              );
            })
            .join("");
        }

        function importForm(track) {
          return (
            '<form id="academy-exam-upload" class="academy-upload">' +
            '<p class="academy-meta">支持 .xlsx / .csv / .json / .docx / .txt。原件不提供下载。' +
            '<a href="/academy-exam-template.csv">下载表格模板</a></p>' +
            '<input type="hidden" name="trackId" value="' +
            escapeHtml(track.id) +
            '" />' +
            '<label class="academy-file">文档 <input type="file" name="file" accept=".xlsx,.csv,.json,.docx,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /></label>' +
            '<button type="submit">导入这一档</button>' +
            '<p class="academy-status" id="academy-exam-status"></p>' +
            "</form>"
          );
        }

        function questionHtml(list) {
          return (list || [])
            .map(function (item) {
              const opts = (item.options || [])
                .map(function (opt) {
                  return (
                    "<label><input type=\"radio\" name=\"q-" +
                    escapeHtml(item.index) +
                    '" value="' +
                    escapeHtml(opt.key) +
                    '" /> ' +
                    escapeHtml(opt.key) +
                    ". " +
                    escapeHtml(opt.text) +
                    "</label>"
                  );
                })
                .join("");
              return (
                '<div class="academy-q" data-index="' +
                escapeHtml(item.index) +
                '"><p><strong>' +
                escapeHtml(item.index) +
                ". " +
                escapeHtml(item.stem) +
                "</strong></p>" +
                opts +
                "</div>"
              );
            })
            .join("");
        }

        function showResult(result) {
          stopTimer();
          const paper = root.querySelector("#academy-paper");
          const rows = (result.detail || [])
            .map(function (item) {
              return (
                "<li>" +
                escapeHtml(item.index) +
                ". " +
                (item.ok ? "对" : "错") +
                " · 你的 " +
                escapeHtml(item.picked || "未答") +
                " / 答案 " +
                escapeHtml(item.answer) +
                "</li>"
              );
            })
            .join("");
          paper.innerHTML =
            "<h2>成绩</h2><p class=\"academy-meta\">" +
            escapeHtml(result.score) +
            " 分 · " +
            (result.passed ? "及格" : "未及格") +
            " · 对 " +
            escapeHtml(result.correct) +
            " / " +
            escapeHtml(result.total) +
            "</p><ul class=\"academy-empty\">" +
            rows +
            "</ul>";
        }

        function submitPaper() {
          if (!trackId) {
            return;
          }
          const answers = collectAnswers();
          postJson("/api/academy/exams/tracks/" + encodeURIComponent(trackId) + "/submit", { answers: answers })
            .then(function (data) {
              if (!dead) {
                showResult(data.result || {});
              }
            })
            .catch(function (err) {
              const paper = root.querySelector("#academy-paper");
              paper.insertAdjacentHTML(
                "beforeend",
                '<p class="academy-status error">' + escapeHtml(err.message) + "</p>"
              );
            });
        }

        function startTimer(minutes) {
          stopTimer();
          remain = Math.max(1, Number(minutes) || 1) * 60;
          ticking = true;
          const el = root.querySelector("#academy-timer");
          function tick() {
            if (!el) {
              return;
            }
            if (remain <= 0) {
              el.textContent = "剩余 00 : 00";
              stopTimer();
              submitPaper();
              return;
            }
            el.textContent = "剩余 " + clock(remain);
            remain -= 1;
          }
          tick();
          timer = setInterval(tick, 1000);
        }

        function openTaking(data) {
          const track = data.track || {};
          const paper = data.paper || {};
          const box = root.querySelector("#academy-paper");
          box.innerHTML =
            "<h2>" +
            escapeHtml(track.name) +
            '</h2><p class="academy-meta">规定 ' +
            escapeHtml(track.minutes) +
            " 分钟 · 到点交卷 · 不可下载原件</p>" +
            '<div class="academy-timer" id="academy-timer" aria-live="polite">剩余 -- : --</div>' +
            '<form id="academy-exam-form">' +
            questionHtml(paper.questions) +
            '<div class="academy-actions"><button type="submit">交卷</button></div></form>';
          startTimer(track.minutes);
          root.querySelector("#academy-exam-form").addEventListener("submit", function (ev) {
            ev.preventDefault();
            submitPaper();
          });
        }

        function openTrack(id) {
          stopTimer();
          trackId = id;
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
              const pack = data.paper || {};
              const ready = Boolean(pack.ready);
              paper.innerHTML =
                "<h2>" +
                escapeHtml(track.name) +
                '</h2><p class="academy-meta">' +
                (ready
                  ? "已导入 " + escapeHtml(pack.questionCount) + " 题 · " + escapeHtml(track.minutes) + " 分钟 · 及格 " + escapeHtml(track.passScore)
                  : "还没有考试文档，导入后才能开考") +
                "</p>" +
                importForm(track) +
                (ready
                  ? '<div class="academy-actions"><button type="button" id="academy-exam-start">开始考试</button></div>'
                  : "") +
                '<div id="academy-exam-take"></div>';
              const form = root.querySelector("#academy-exam-upload");
              form.addEventListener("submit", function (ev) {
                ev.preventDefault();
                const status = root.querySelector("#academy-exam-status");
                const fd = new FormData(form);
                status.textContent = "正在解析…";
                status.className = "academy-status";
                postForm("/api/academy/exams/papers", fd)
                  .then(function () {
                    return api("/api/academy/exams/tracks").then(function (list) {
                      if (!dead) {
                        renderTracks(list.tracks);
                      }
                      return openTrack(id);
                    });
                  })
                  .catch(function (err) {
                    status.textContent = err.message;
                    status.className = "academy-status error";
                  });
              });
              const start = root.querySelector("#academy-exam-start");
              if (start) {
                start.addEventListener("click", function () {
                  api("/api/academy/exams/tracks/" + encodeURIComponent(id)).then(function (fresh) {
                    if (!dead) {
                      openTaking(fresh);
                    }
                  });
                });
              }
            })
            .catch(function (err) {
              paper.innerHTML = '<h2>试卷</h2><p class="academy-status error">' + escapeHtml(err.message) + "</p>";
            });
        }

        api("/api/academy/exams/tracks")
          .then(function (data) {
            if (!dead) {
              renderTracks(data.tracks);
            }
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
          openTrack(btn.getAttribute("data-id"));
        });
        return function () {
          dead = true;
          stopTimer();
          unmount();
        };
      }
    };
  }

  function handbookPage() {
    return {
      mount: function (root) {
        let editorOk = canEditHandbook();
        const unmount = mountShell(
          root,
          consoleFrame(
            '<div class="academy-console-body" id="academy-handbook-pane">' +
              '<aside class="academy-console-side">' +
              '<nav class="academy-tree" id="academy-tree"></nav>' +
              '<button type="button" class="academy-add-group" id="academy-add-group" hidden>添加分组</button>' +
              '<form id="academy-group-form" class="academy-sub-form academy-group-form" hidden><input name="title" maxlength="160" placeholder="分组名称" required /><button type="submit">添加</button></form>' +
              "</aside>" +
              '<section class="academy-console-main" id="academy-section">' +
              '<div class="academy-board"><div class="academy-board-head"><h2>课件展示</h2></div>' +
              '<p class="academy-empty">点左侧一节阅读，双击修改。</p></div></section>' +
              "</div>" +
              '<div id="academy-log-box" class="academy-console-logs" hidden></div>',
            [{ id: "academy-open-logs", label: "操作日志" }]
          )
        );
        let dead = false;
        let currentId = "";
        let clickTimer = 0;
        let editing = false;
        let logsOn = false;

        function renderBody(text) {
          return String(text || "")
            .split("\n")
            .map(function (line) {
              const hit = line.match(/^!\[(.*?)\]\((\/api\/academy\/handbook\/media\/[A-Za-z0-9._-]+)\)$/);
              if (hit) {
                return (
                  '<p><img src="' +
                  escapeHtml(hit[2]) +
                  '" alt="' +
                  escapeHtml(hit[1]) +
                  '" /></p>'
                );
              }
              return "<p>" + escapeHtml(line) + "</p>";
            })
            .join("");
        }

        function treeHtml(nodes, depth) {
          return (nodes || [])
            .map(function (node) {
              const kids = node.children || [];
              const top = !depth;
              return (
                '<div class="academy-tree-group' +
                (top ? "" : " is-sub") +
                '">' +
                '<div class="academy-tree-row">' +
                '<button type="button" class="academy-tree-item' +
                (top ? " is-group" : "") +
                (node.id === currentId ? " is-on" : "") +
                '" data-id="' +
                escapeHtml(node.id) +
                '">' +
                escapeHtml(node.title) +
                (node.hasBody ? '<span class="academy-badge is-pub">已写</span>' : "") +
                "</button>" +
                (editorOk
                  ? '<button type="button" class="academy-tree-add" data-add="' +
                    escapeHtml(node.id) +
                    '" title="添加子菜单">+</button>'
                  : "") +
                "</div>" +
                (editorOk
                  ? '<form class="academy-sub-form" data-parent="' +
                    escapeHtml(node.id) +
                    '" hidden><input name="title" maxlength="160" placeholder="子菜单名称" required /><button type="submit">添加</button></form>'
                  : "") +
                '<div class="academy-tree-kids">' +
                treeHtml(kids, (depth || 0) + 1) +
                "</div></div>"
              );
            })
            .join("");
        }

        function syncEditorChrome() {
          const addGroup = root.querySelector("#academy-add-group");
          if (addGroup) {
            addGroup.hidden = !editorOk;
          }
        }

        function loadTree() {
          return api("/api/academy/handbook/tree").then(function (data) {
            if (dead) {
              return data;
            }
            editorOk = Boolean(data.canEdit) || canEditHandbook();
            const tree = root.querySelector("#academy-tree");
            tree.innerHTML = treeHtml(data.tree, 0);
            syncEditorChrome();
            return data;
          });
        }

        function paintView(section) {
          const box = root.querySelector("#academy-section");
          box.innerHTML =
            '<div class="academy-board" data-handbook-view="1">' +
            '<div class="academy-board-head"><h2>' +
            escapeHtml(section.title || "课件展示") +
            "</h2>" +
            '<p class="academy-board-meta">' +
            (editorOk ? "双击标题或正文即可修改" : "只读") +
            "</p></div>" +
            '<div class="academy-board-body" id="academy-handbook-preview">' +
            (section.body ? renderBody(section.body) : '<p class="academy-empty">还没有正文，双击开始写。</p>') +
            "</div></div>";
        }

        function paintEditor(section) {
          const box = root.querySelector("#academy-section");
          box.innerHTML =
            '<div class="academy-board academy-editor">' +
            '<form id="academy-handbook-form">' +
            '<input class="academy-title-input" name="title" maxlength="160" value="' +
            escapeHtml(section.title) +
            '" />' +
            '<textarea name="body" id="academy-handbook-body" rows="12">' +
            escapeHtml(section.body) +
            "</textarea>" +
            '<div class="academy-tools"><button type="submit">保存</button>' +
            '<button type="button" class="ghost" id="academy-handbook-cancel">取消</button>' +
            '<p class="academy-status" id="academy-handbook-status"></p></div></form>' +
            '<form id="academy-handbook-image" class="academy-tools">' +
            '<input type="file" name="file" accept="image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp" />' +
            '<button type="submit">插入图片</button></form></div>';
        }

        function openSection(id, edit) {
          currentId = id;
          editing = Boolean(edit) && editorOk;
          api("/api/academy/handbook/sections/" + encodeURIComponent(id))
            .then(function (data) {
              if (dead) {
                return;
              }
              const section = data.section || {};
              if (editing) {
                paintEditor(section);
              } else {
                paintView(section);
              }
              root.querySelectorAll(".academy-tree-item").forEach(function (el) {
                el.classList.toggle("is-on", el.getAttribute("data-id") === id);
              });
            })
            .catch(function (err) {
              root.querySelector("#academy-section").innerHTML =
                '<h2>本节</h2><p class="academy-status error">' + escapeHtml(err.message) + "</p>";
            });
        }

        function showLogs(on) {
          logsOn = Boolean(on);
          const pane = root.querySelector("#academy-handbook-pane");
          const box = root.querySelector("#academy-log-box");
          const tab = root.querySelector("#academy-open-logs");
          if (pane) {
            pane.hidden = logsOn;
          }
          if (box) {
            box.hidden = !logsOn;
          }
          if (tab) {
            tab.classList.toggle("is-on", logsOn);
          }
          if (logsOn && box) {
            fillLogs(box);
          }
        }

        function addBranch(parentId, title) {
          return postJson("/api/academy/handbook/branches", {
            parentId: parentId || "",
            title: title
          }).then(function (data) {
            return loadTree().then(function () {
              if (data.section && data.section.id) {
                openSection(data.section.id, true);
              }
            });
          });
        }

        loadTree().catch(function (err) {
          const tree = root.querySelector("#academy-tree");
          if (tree) {
            tree.innerHTML = '<p class="academy-status error">' + escapeHtml(err.message) + "</p>";
          }
        });
        const jump = root.querySelector("#academy-open-logs");
        if (jump) {
          jump.addEventListener("click", function (ev) {
            ev.preventDefault();
            showLogs(!logsOn);
          });
        }
        const brand = root.querySelector("#academy-brand");
        if (brand) {
          brand.addEventListener("click", function () {
            showLogs(false);
          });
        }
        const addGroup = root.querySelector("#academy-add-group");
        const groupForm = root.querySelector("#academy-group-form");
        if (addGroup && groupForm) {
          addGroup.addEventListener("click", function () {
            groupForm.hidden = !groupForm.hidden;
            const input = groupForm.querySelector("input");
            if (!groupForm.hidden && input) {
              input.focus();
            }
          });
          groupForm.addEventListener("submit", function (ev) {
            ev.preventDefault();
            addBranch("", groupForm.title.value)
              .then(function () {
                groupForm.reset();
                groupForm.hidden = true;
              })
              .catch(function (err) {
                groupForm.hidden = false;
                groupForm.setAttribute("data-error", err.message);
              });
          });
        }

        root.querySelector("#academy-tree").addEventListener("click", function (ev) {
          const add = ev.target.closest("[data-add]");
          if (add) {
            ev.preventDefault();
            ev.stopPropagation();
            window.clearTimeout(clickTimer);
            clickTimer = 0;
            const form = add.closest(".academy-tree-group").querySelector(".academy-sub-form");
            if (form) {
              form.hidden = !form.hidden;
              const input = form.querySelector("input");
              if (!form.hidden && input) {
                input.focus();
              }
            }
            return;
          }
          const btn = ev.target.closest("[data-id]");
          if (!btn) {
            return;
          }
          const id = btn.getAttribute("data-id");
          window.clearTimeout(clickTimer);
          clickTimer = window.setTimeout(function () {
            clickTimer = 0;
            openSection(id, false);
          }, 220);
        });
        root.querySelector("#academy-tree").addEventListener("dblclick", function (ev) {
          if (ev.target.closest("[data-add]") || ev.target.closest("form")) {
            return;
          }
          const btn = ev.target.closest("[data-id]");
          if (!btn) {
            return;
          }
          ev.preventDefault();
          window.clearTimeout(clickTimer);
          clickTimer = 0;
          if (!editorOk) {
            return;
          }
          openSection(btn.getAttribute("data-id"), true);
        });
        root.querySelector("#academy-tree").addEventListener("submit", function (ev) {
          const form = ev.target.closest(".academy-sub-form");
          if (!form) {
            return;
          }
          ev.preventDefault();
          const parentId = form.getAttribute("data-parent");
          const title = form.title.value;
          addBranch(parentId, title).catch(function (err) {
            form.hidden = false;
            form.setAttribute("data-error", err.message);
          });
        });

        root.querySelector("#academy-section").addEventListener("dblclick", function (ev) {
          if (!editorOk || !currentId) {
            return;
          }
          if (ev.target.closest("form") || ev.target.closest("textarea") || ev.target.closest("input")) {
            return;
          }
          openSection(currentId, true);
        });

        root.querySelector("#academy-section").addEventListener("click", function (ev) {
          if (ev.target && ev.target.id === "academy-handbook-cancel" && currentId) {
            openSection(currentId, false);
          }
        });

        root.querySelector("#academy-section").addEventListener("submit", function (ev) {
          const form = ev.target;
          if (!form || !currentId) {
            return;
          }
          if (form.id === "academy-handbook-form") {
            ev.preventDefault();
            const status = root.querySelector("#academy-handbook-status");
            postJson("/api/academy/handbook/sections/" + encodeURIComponent(currentId), {
              title: form.title.value,
              body: form.body.value
            })
              .then(function (data) {
                status.textContent = "已保存";
                status.className = "academy-status";
                editing = false;
                paintView(data.section);
                return loadTree();
              })
              .catch(function (err) {
                status.textContent = err.message;
                status.className = "academy-status error";
              });
            return;
          }
          if (form.id === "academy-handbook-image") {
            ev.preventDefault();
            const fd = new FormData(form);
            postForm("/api/academy/handbook/sections/" + encodeURIComponent(currentId) + "/images", fd)
              .then(function (data) {
                paintEditor(data.section);
                return loadTree();
              })
              .catch(function (err) {
                const status = root.querySelector("#academy-handbook-status");
                if (status) {
                  status.textContent = err.message;
                  status.className = "academy-status error";
                }
              });
          }
        });

        return function () {
          dead = true;
          window.clearTimeout(clickTimer);
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchLogMenu);
  } else {
    watchLogMenu();
  }
})();
