/* xm-module-academy 0.1.466 · course-folder-input */
(function () {
  const ASSET_VER = "0.1.466";
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
          '<div class="academy-board-head"><h2>操作日志</h2></div>' +
          '<p class="academy-board-meta">学院操作记录，与手册目录分开。</p>' +
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
      qs.set("folderId", formEl.folderId.value);
      qs.set(
        "category",
        formEl.folderId.options[formEl.folderId.selectedIndex]
          ? formEl.folderId.options[formEl.folderId.selectedIndex].textContent
          : ""
      );
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
      '<div class="academy-console is-home">' +
      '<div class="academy-console-top">' +
      '<button type="button" class="academy-brand" id="academy-brand">星脉甄选商学院</button>' +
      (tabHtml ? '<nav class="academy-console-tabs">' + tabHtml + "</nav>" : "") +
      "</div>" +
      inner +
      "</div>"
    );
  }

  function logPaneHtml() {
    return '<div id="academy-log-box" class="academy-console-logs" hidden></div>';
  }

  function uploadPaneHtml() {
    return (
      '<div class="academy-console-stage" id="academy-view-upload" hidden>' +
      '<form id="academy-upload" class="academy-toolbar">' +
      '<label>标题 <input name="title" maxlength="160" placeholder="选文件后自动填写" /></label>' +
      '<label>分类 <select name="folderId" id="academy-course-folder-select" required>' +
      '<option value="">请先选择分类</option></select></label>' +
      '<label><input type="checkbox" name="published" checked /> 发布</label>' +
      '<label>课件 <input type="file" name="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" required /></label>' +
      '<button type="submit">上传</button>' +
      "</form>" +
      '<p class="academy-status" id="academy-upload-status"></p>' +
      "</div>" +
      logPaneHtml()
    );
  }

  function courseTitleFromFile(file) {
    return String((file && file.name) || "")
      .replace(/\.pptx?$/i, "")
      .trim()
      .slice(0, 160);
  }

  function agentDebugLog(payload) {
    fetch("/__agent-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ timestamp: Date.now() }, payload))
    }).catch(function () {});
  }

  function replaceTitleSelection(input, text, start, end) {
    input.setRangeText(text, start, end, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function isVisibleInputText(text) {
    return (
      Boolean(text) &&
      !Array.from(text).some(function (character) {
        const code = character.codePointAt(0);
        return code < 32 || (code >= 127 && code <= 159);
      })
    );
  }

  function installTitleKeyboardFallback(input) {
    let composing = false;
    let compositionValue = "";
    let compositionStart = 0;
    let compositionEnd = 0;
    // #region agent log
    agentDebugLog({
      hypothesisId: "A",
      location: "academy.js:installTitleKeyboardFallback",
      message: "install title input listeners",
      data: { connected: input.isConnected, className: input.parentElement && input.parentElement.className }
    });
    // #endregion
    input.addEventListener("beforeinput", function (ev) {
      const text = String(ev.data || "");
      // #region agent log
      agentDebugLog({
        hypothesisId: "C",
        location: "academy.js:beforeinput",
        message: "title beforeinput event",
        data: { inputType: ev.inputType, dataLength: text.length, composing: composing, valueLength: input.value.length }
      });
      // #endregion
      if (!composing && ev.inputType === "insertText" && isVisibleInputText(text)) {
        ev.preventDefault();
        const start = input.selectionStart == null ? input.value.length : input.selectionStart;
        const end = input.selectionEnd == null ? start : input.selectionEnd;
        replaceTitleSelection(input, text, start, end);
      }
    });
    input.addEventListener("compositionstart", function () {
      composing = true;
      compositionValue = input.value;
      compositionStart = input.selectionStart == null ? input.value.length : input.selectionStart;
      compositionEnd = input.selectionEnd == null ? compositionStart : input.selectionEnd;
    });
    input.addEventListener("compositionend", function (ev) {
      composing = false;
      const text = String(ev.data || "");
      window.setTimeout(function () {
        if (isVisibleInputText(text) && input.value === compositionValue) {
          replaceTitleSelection(input, text, compositionStart, compositionEnd);
        }
      }, 0);
    });
    input.addEventListener("keydown", function (ev) {
      // #region agent log
      agentDebugLog({
        hypothesisId: "C",
        location: "academy.js:keydown",
        message: "title keydown event",
        data: { keyLength: ev.key.length, composing: composing, eventComposing: ev.isComposing, valueLength: input.value.length }
      });
      // #endregion
      if (composing || ev.isComposing || ev.key === "Process" || ev.ctrlKey || ev.metaKey || ev.altKey) {
        return;
      }
      const start = input.selectionStart == null ? input.value.length : input.selectionStart;
      const end = input.selectionEnd == null ? start : input.selectionEnd;
      if (ev.key.length === 1 && isVisibleInputText(ev.key)) {
        ev.preventDefault();
        replaceTitleSelection(input, ev.key, start, end);
        return;
      }
      if (ev.key === "Backspace") {
        ev.preventDefault();
        replaceTitleSelection(input, "", start === end ? Math.max(0, start - 1) : start, end);
        return;
      }
      if (ev.key === "Delete") {
        ev.preventDefault();
        replaceTitleSelection(input, "", start, start === end ? Math.min(input.value.length, end + 1) : end);
      }
    });
  }

  function examUploadPaneHtml() {
    return (
      '<div class="academy-console-stage" id="academy-view-upload" hidden>' +
      '<h2>导入考试文档</h2>' +
      '<p class="academy-meta">直接传现成 Word / 表格即可，不必套选择题模板。选择题、填空、问答都能认；答案写在题后「答案：」或文末「参考答案」。原件不提供下载。' +
      '<a href="/academy-exam-template.csv">也可下载表格样例</a></p>' +
      '<form id="academy-exam-upload" class="academy-toolbar">' +
      '<label>考试档 <select name="trackId" id="academy-exam-track" required></select></label>' +
      '<label>文档 <input type="file" name="file" accept=".xlsx,.csv,.json,.docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label>' +
      '<button type="submit">导入这一档</button>' +
      "</form>" +
      '<p class="academy-status" id="academy-exam-status"></p>' +
      "</div>" +
      logPaneHtml()
    );
  }

  function chromeTabs() {
    return [
      { id: "academy-tab-upload", label: "文件上传" },
      { id: "academy-open-logs", label: "操作日志" }
    ];
  }

  function setConsoleView(root, name) {
    const shell = root.querySelector(".academy-console");
    if (shell) {
      shell.classList.toggle("is-home", name === "home");
      shell.classList.toggle("is-upload", name === "upload");
      shell.classList.toggle("is-logs", name === "logs");
      Array.prototype.forEach.call(shell.children, function (el) {
        if (el.classList.contains("academy-console-top")) {
          return;
        }
        const show =
          (name === "logs" && el.id === "academy-log-box") ||
          (name === "upload" && el.id === "academy-view-upload") ||
          (name === "home" &&
            (el.id === "academy-handbook-pane" ||
              el.id === "academy-view-courses" ||
              el.id === "academy-view-exams"));
        el.hidden = !show;
        if (show) {
          el.style.removeProperty("display");
          el.style.removeProperty("visibility");
          el.style.removeProperty("height");
          el.style.removeProperty("overflow");
          el.removeAttribute("inert");
        } else {
          el.style.setProperty("display", "none", "important");
          el.setAttribute("inert", "");
        }
      });
    }
    const home = root.querySelector("#academy-view-courses, #academy-view-exams, #academy-handbook-pane");
    const uploadBox = root.querySelector("#academy-view-upload");
    const logBox = root.querySelector("#academy-log-box");
    if (home) {
      home.hidden = name !== "home";
    }
    if (uploadBox) {
      uploadBox.hidden = name !== "upload";
    }
    if (logBox) {
      logBox.hidden = name !== "logs";
    }
  }

  function bindAcademyChrome(root, homeId, afterUpload) {
    function showView(name) {
      const home = root.querySelector("#" + homeId);
      const uploadBox = root.querySelector("#academy-view-upload");
      const logBox = root.querySelector("#academy-log-box");
      const uploadTab = root.querySelector("#academy-tab-upload");
      const logTab = root.querySelector("#academy-open-logs");
      setConsoleView(root, name);
      if (home && homeId) {
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
      const titleInput = form.querySelector('input[name="title"]');
      const fileInput = form.querySelector('input[type="file"]');
      if (fileInput && titleInput) {
        installTitleKeyboardFallback(titleInput);
        fileInput.addEventListener("change", function () {
          const file = fileInput.files && fileInput.files[0];
          if (!String(titleInput.value || "").trim()) {
            titleInput.value = courseTitleFromFile(file);
          }
        });
      }
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        const status = root.querySelector("#academy-upload-status");
        const file = fileInput && fileInput.files && fileInput.files[0];
        if (titleInput && !String(titleInput.value || "").trim()) {
          titleInput.value = courseTitleFromFile(file);
        }
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
            '<div class="academy-console-body" id="academy-view-courses">' +
              '<aside class="academy-console-side academy-course-pane" id="academy-side">' +
              '<div class="academy-board-head"><h2>课件分类</h2></div>' +
              '<div class="academy-course-list academy-course-tree" id="academy-course-list"></div>' +
              '<button type="button" class="academy-add-group" id="academy-course-add-group" hidden>新建分类</button>' +
              '<form id="academy-course-group-form" class="academy-sub-form academy-group-form" hidden>' +
              '<input name="title" maxlength="64" placeholder="分类名称" /><button type="submit">新建</button></form>' +
              '<div class="academy-thumbs" id="academy-thumbs" hidden></div></aside>' +
              '<section class="academy-console-main" id="academy-viewer"></section>' +
              "</div>" +
              uploadPaneHtml(),
            chromeTabs()
          )
        );
        let dead = false;
        let currentId = "";
        let pageCount = 0;
        let pageNo = 1;
        let pages = [];
        let previewOn = false;
        let courseFolders = [];
        let courseItems = [];
        let courseEditor = false;
        let draggingCourse = "";
        let draggingFolder = "";
        const showView = bindAcademyChrome(root, "academy-view-courses", function (data) {
          loadList().then(function () {
            if (data.course && data.course.id) {
              openPreview(data.course.id);
            }
          });
        });

        function folderOptions(nodes, depth) {
          return (nodes || [])
            .map(function (folder) {
              return (
                '<option value="' +
                escapeHtml(folder.id) +
                '">' +
                escapeHtml(new Array((depth || 0) + 1).join("　") + folder.title) +
                "</option>" +
                folderOptions(folder.children, (depth || 0) + 1)
              );
            })
            .join("");
        }

        function courseButton(item) {
          return (
            '<button type="button" class="academy-course' +
            (item.id === currentId ? " is-on" : "") +
            '" data-course-id="' +
            escapeHtml(item.id) +
            '"' +
            (courseEditor ? ' draggable="true"' : "") +
            '><h3>' +
            escapeHtml(item.title) +
            '</h3><p class="academy-meta">' +
            escapeHtml(item.pageCount) +
            " 页 · " +
            (item.published ? "已发布" : "草稿") +
            "</p></button>"
          );
        }

        function courseFolderHtml(nodes, depth) {
          return (nodes || [])
            .map(function (folder) {
              const items = courseItems.filter(function (item) {
                return item.folderId === folder.id;
              });
              return (
                '<div class="academy-course-folder" data-folder-group="' +
                escapeHtml(folder.id) +
                '">' +
                '<div class="academy-tree-row academy-course-folder-row" data-folder-row="' +
                escapeHtml(folder.id) +
                '"' +
                (courseEditor ? ' draggable="true"' : "") +
                '><button type="button" class="academy-tree-item is-group">' +
                escapeHtml(folder.title) +
                '<span class="academy-folder-count">' +
                escapeHtml(items.length) +
                "</span></button>" +
                (courseEditor
                  ? '<button type="button" class="academy-tree-add" data-course-add="' +
                    escapeHtml(folder.id) +
                    '" title="添加子菜单">+</button>'
                  : "") +
                "</div>" +
                (courseEditor
                  ? '<form class="academy-sub-form academy-course-sub-form" data-course-parent="' +
                    escapeHtml(folder.id) +
                    '" hidden><input name="title" maxlength="64" placeholder="子菜单名称" />' +
                    '<button type="submit">新建</button></form>'
                  : "") +
                '<div class="academy-course-folder-kids">' +
                courseFolderHtml(folder.children || [], (depth || 0) + 1) +
                items.map(courseButton).join("") +
                "</div></div>"
              );
            })
            .join("");
        }

        function renderList(items, folders) {
          const box = root.querySelector("#academy-course-list");
          courseItems = items || [];
          courseFolders = folders || [];
          box.innerHTML = courseFolderHtml(courseFolders, 0);
          // #region agent log
          agentDebugLog({
            hypothesisId: "D",
            location: "academy.js:renderList",
            message: "course list rendered",
            data: { folderCount: courseFolders.length, subInputCount: box.querySelectorAll(".academy-course-sub-form input").length }
          });
          // #endregion
          if (!courseFolders.length) {
            box.innerHTML = '<p class="academy-empty">还没有分类，请先新建分类。</p>';
          } else if (!courseItems.length) {
            box.insertAdjacentHTML(
              "beforeend",
              '<p class="academy-empty academy-course-empty">还没有课件。到「文件上传」导入 PPTX，不提供原件下载。</p>'
            );
          }
          const select = root.querySelector("#academy-course-folder-select");
          if (select) {
            const keep = select.value;
            select.innerHTML =
              '<option value="">请选择分类</option>' + folderOptions(courseFolders, 0);
            if (keep) {
              select.value = keep;
            }
          }
          const addGroup = root.querySelector("#academy-course-add-group");
          if (addGroup) {
            addGroup.hidden = !courseEditor;
          }
          root.querySelectorAll(".academy-course-sub-form input").forEach(function (input) {
            installTitleKeyboardFallback(input);
          });
        }

        function loadList() {
          return api("/api/academy/courses").then(function (data) {
            if (!dead) {
              courseEditor = Boolean(data.canEdit);
              renderList(data.items || [], data.folders || []);
            }
            return data;
          });
        }

        function slideUrl(index) {
          const hit = pages.find(function (page) {
            return Number(page.index) === Number(index);
          });
          return hit && hit.slide ? hit.slide.url : "";
        }

        function markThumbs() {
          root.querySelectorAll(".academy-thumb").forEach(function (el) {
            el.classList.toggle("is-on", Number(el.getAttribute("data-index")) === Number(pageNo));
          });
          const cap = root.querySelector("#academy-slide-cap");
          if (cap) {
            cap.textContent = "第 " + pageNo + " / " + pageCount + " 页 · 点大图全屏";
          }
        }

        function setSlide(index) {
          if (index < 1 || index > pageCount) {
            return;
          }
          pageNo = index;
          const url = slideUrl(index);
          const img = root.querySelector("#academy-slide-img");
          const fsImg = root.querySelector("#academy-fs-img");
          if (img && url) {
            img.src = url;
          }
          if (fsImg && url) {
            fsImg.src = url;
          }
          markThumbs();
        }

        function exitFs() {
          const box = root.querySelector("#academy-fs");
          if (box) {
            box.hidden = true;
          }
        }

        function enterFs() {
          const box = root.querySelector("#academy-fs");
          const img = root.querySelector("#academy-fs-img");
          if (!box || !img) {
            return;
          }
          img.src = slideUrl(pageNo);
          box.hidden = false;
          img.focus();
        }

        function emptyViewer() {
          return (
            '<div class="academy-board"><div class="academy-board-head"><h2>课件展示</h2></div>' +
            '<p class="academy-empty">点左侧课件在此翻页。再点同一课件可收起页签。</p></div>'
          );
        }

        function closePreview() {
          previewOn = false;
          currentId = "";
          pages = [];
          const panel = root.querySelector("#academy-viewer");
          const thumbs = root.querySelector("#academy-thumbs");
          if (thumbs) {
            thumbs.hidden = true;
            thumbs.innerHTML = "";
          }
          if (panel) {
            panel.innerHTML = emptyViewer();
          }
          exitFs();
          root.querySelectorAll(".academy-course").forEach(function (el) {
            el.classList.remove("is-on");
          });
        }

        function paintThumbs() {
          const box = root.querySelector("#academy-thumbs");
          if (!box) {
            return;
          }
          if (!pages.length) {
            box.hidden = true;
            box.innerHTML = "";
            return;
          }
          box.hidden = false;
          box.removeAttribute("hidden");
          box.innerHTML = pages
            .map(function (page) {
              const url = page.slide ? page.slide.url : "";
              return (
                '<button type="button" class="academy-thumb' +
                (Number(page.index) === Number(pageNo) ? " is-on" : "") +
                '" data-index="' +
                escapeHtml(page.index) +
                '"><img src="' +
                escapeHtml(url) +
                '" alt="第 ' +
                escapeHtml(page.index) +
                ' 页" draggable="false" /><span>' +
                escapeHtml(page.index) +
                "</span></button>"
              );
            })
            .join("");
        }

        function paintMissing(course, err) {
          const panel = root.querySelector("#academy-viewer");
          const thumbs = root.querySelector("#academy-thumbs");
          if (thumbs) {
            thumbs.hidden = true;
            thumbs.innerHTML = "";
          }
          if (!panel) {
            return;
          }
          panel.innerHTML =
            '<div class="academy-board-head"><h2>课件展示</h2></div>' +
            "<h3>" +
            escapeHtml((course && course.title) || "课件") +
            "</h3>" +
            '<p class="academy-status error">' +
            escapeHtml(err || "这一课还没有生成幻灯片。请到「文件上传」重新导入 PPTX。") +
            "</p>";
        }

        function paintDeck(title) {
          const panel = root.querySelector("#academy-viewer");
          if (!pages.length || !slideUrl(pageNo)) {
            paintMissing({ title: title }, "");
            return;
          }
          const mark = watermarkText();
          const tiles = new Array(18).fill(escapeHtml(mark)).join(" ");
          paintThumbs();
          panel.innerHTML =
            '<div class="academy-board-head"><h2>课件展示</h2><p class="academy-board-meta" id="academy-slide-cap">第 ' +
            escapeHtml(pageNo) +
            " / " +
            escapeHtml(pageCount) +
            " 页 · 点大图全屏</p></div>" +
            '<p class="academy-meta">' +
            escapeHtml(title || "课件") +
            "</p>" +
            '<div class="academy-deck">' +
            '<div class="academy-stage" id="academy-stage">' +
            '<img class="academy-slide-img" id="academy-slide-img" src="' +
            escapeHtml(slideUrl(pageNo)) +
            '" alt="" draggable="false" />' +
            '<div class="academy-wm" aria-hidden="true">' +
            tiles +
            "</div></div></div>" +
            '<div id="academy-fs" class="academy-fs" hidden>' +
            '<img class="academy-fs-img" id="academy-fs-img" tabindex="-1" draggable="false" alt="" />' +
            '<button type="button" class="academy-fs-btn academy-fs-prev" data-fs="-1">上一页</button>' +
            '<button type="button" class="academy-fs-btn academy-fs-next" data-fs="1">下一页</button>' +
            '<p class="academy-fs-hint">← → 翻页 · Esc 退出全屏</p></div>';
        }

        function openPreview(id) {
          if (previewOn && currentId === id) {
            closePreview();
            return Promise.resolve();
          }
          const panel = root.querySelector("#academy-viewer");
          if (panel) {
            panel.innerHTML =
              '<div class="academy-board-head"><h2>课件展示</h2></div>' +
              '<p class="academy-empty">正在打开课件，生成幻灯片…</p>';
          }
          return api("/api/academy/courses/" + encodeURIComponent(id)).then(function (data) {
            if (dead) {
              return data;
            }
            currentId = id;
            previewOn = true;
            pages = data.pages || (data.course && data.course.pages) || [];
            pageCount = pages.length;
            pageNo = 1;
            root.querySelectorAll(".academy-course").forEach(function (el) {
              el.classList.toggle("is-on", el.getAttribute("data-course-id") === id);
            });
            if (!pages.length) {
              paintMissing(data.course, data.renderError || (data.course && data.course.renderError));
              return data;
            }
            paintDeck(data.course && data.course.title);
            return data;
          });
        }

        root.querySelector("#academy-viewer").innerHTML = emptyViewer();

        loadList().catch(function (err) {
          const box = root.querySelector("#academy-course-list");
          if (box) {
            box.innerHTML = '<p class="academy-status error">' + escapeHtml(err.message) + "</p>";
          }
        });

        root.querySelector("#academy-course-list").addEventListener("click", function (ev) {
          const add = ev.target.closest("[data-course-add]");
          if (add) {
            ev.preventDefault();
            ev.stopPropagation();
            const group = add.closest(".academy-course-folder");
            const form = group && group.querySelector(":scope > .academy-course-sub-form");
            // #region agent log
            agentDebugLog({
              hypothesisId: "B",
              location: "academy.js:courseAddClick",
              message: "resolve child form",
              data: { groupFound: Boolean(group), formFound: Boolean(form), hidden: form ? form.hidden : null }
            });
            // #endregion
            if (form) {
              form.hidden = !form.hidden;
              const input = form.querySelector("input");
              if (!form.hidden && input) {
                input.focus();
                // #region agent log
                agentDebugLog({
                  hypothesisId: "A",
                  location: "academy.js:courseAddFocus",
                  message: "focus child title input",
                  data: { connected: input.isConnected, active: document.activeElement === input, hidden: form.hidden }
                });
                // #endregion
              }
            }
            return;
          }
          const btn = ev.target.closest("[data-course-id]");
          if (!btn) {
            return;
          }
          openPreview(btn.getAttribute("data-course-id")).catch(function (err) {
            const panel = root.querySelector("#academy-viewer");
            panel.innerHTML =
              '<div class="academy-board-head"><h2>课件展示</h2></div>' +
              '<p class="academy-status error">' +
              escapeHtml(err.message) +
              "</p>";
          });
        });

        function addCourseFolder(parentId, title) {
          return postJson("/api/academy/courses/folders", {
            parentId: parentId || "",
            title: title
          }).then(loadList);
        }

        const addCourseGroup = root.querySelector("#academy-course-add-group");
        const courseGroupForm = root.querySelector("#academy-course-group-form");
        if (courseGroupForm) {
          const groupInput = courseGroupForm.querySelector("input");
          installTitleKeyboardFallback(groupInput);
          addCourseGroup.addEventListener("click", function () {
            courseGroupForm.hidden = !courseGroupForm.hidden;
            if (!courseGroupForm.hidden) {
              groupInput.focus();
            }
          });
          courseGroupForm.addEventListener("submit", function (ev) {
            ev.preventDefault();
            addCourseFolder("", groupInput.value)
              .then(function () {
                courseGroupForm.reset();
                courseGroupForm.hidden = true;
              })
              .catch(function (err) {
                courseGroupForm.hidden = false;
                courseGroupForm.setAttribute("data-error", err.message);
              });
          });
        }

        root.querySelector("#academy-course-list").addEventListener("submit", function (ev) {
          const form = ev.target.closest(".academy-course-sub-form");
          if (!form) {
            return;
          }
          ev.preventDefault();
          // #region agent log
          agentDebugLog({
            hypothesisId: "E",
            location: "academy.js:courseSubSubmit",
            message: "submit child folder",
            data: { connected: form.isConnected, titleLength: form.title.value.length }
          });
          // #endregion
          addCourseFolder(form.getAttribute("data-course-parent"), form.title.value).catch(function (err) {
            form.hidden = false;
            form.setAttribute("data-error", err.message);
          });
        });

        function clearCourseDropMarks() {
          root.querySelectorAll(".academy-course-folder-row").forEach(function (row) {
            row.classList.remove("is-drop-before", "is-drop-after", "is-drop-inside");
          });
        }

        function folderMovePayload(row, ev) {
          const targetId = row.getAttribute("data-folder-row");
          const group = row.closest(".academy-course-folder");
          const rect = row.getBoundingClientRect();
          const ratio = rect.height ? (ev.clientY - rect.top) / rect.height : 0.5;
          if (ratio >= 0.3 && ratio <= 0.7) {
            return { id: draggingFolder, parentId: targetId };
          }
          const parentGroup =
            group && group.parentElement ? group.parentElement.closest(".academy-course-folder") : null;
          const parentId = parentGroup ? parentGroup.getAttribute("data-folder-group") : "";
          if (ratio < 0.3) {
            return { id: draggingFolder, beforeId: targetId };
          }
          const next = group && group.nextElementSibling;
          if (next && next.classList.contains("academy-course-folder")) {
            return { id: draggingFolder, beforeId: next.getAttribute("data-folder-group") };
          }
          return { id: draggingFolder, parentId: parentId };
        }

        const courseTree = root.querySelector("#academy-course-list");
        courseTree.addEventListener("dragstart", function (ev) {
          if (!courseEditor || ev.target.closest("form") || ev.target.closest("[data-course-add]")) {
            ev.preventDefault();
            return;
          }
          const course = ev.target.closest("[data-course-id]");
          const row = ev.target.closest("[data-folder-row]");
          draggingCourse = course ? course.getAttribute("data-course-id") : "";
          draggingFolder = !draggingCourse && row ? row.getAttribute("data-folder-row") : "";
          if (!draggingCourse && !draggingFolder) {
            ev.preventDefault();
            return;
          }
          ev.dataTransfer.effectAllowed = "move";
          ev.dataTransfer.setData("text/plain", draggingCourse || draggingFolder);
        });
        courseTree.addEventListener("dragend", function () {
          draggingCourse = "";
          draggingFolder = "";
          clearCourseDropMarks();
        });
        courseTree.addEventListener("dragover", function (ev) {
          const row = ev.target.closest("[data-folder-row]");
          if (!row || (!draggingCourse && !draggingFolder)) {
            return;
          }
          ev.preventDefault();
          clearCourseDropMarks();
          if (draggingCourse) {
            row.classList.add("is-drop-inside");
            return;
          }
          const rect = row.getBoundingClientRect();
          const ratio = rect.height ? (ev.clientY - rect.top) / rect.height : 0.5;
          row.classList.add(ratio < 0.3 ? "is-drop-before" : ratio > 0.7 ? "is-drop-after" : "is-drop-inside");
        });
        courseTree.addEventListener("drop", function (ev) {
          const row = ev.target.closest("[data-folder-row]");
          if (!row || (!draggingCourse && !draggingFolder)) {
            return;
          }
          ev.preventDefault();
          const targetId = row.getAttribute("data-folder-row");
          const request = draggingCourse
            ? postJson("/api/academy/courses/" + encodeURIComponent(draggingCourse) + "/move", {
                folderId: targetId
              })
            : postJson("/api/academy/courses/folders/reorder", folderMovePayload(row, ev));
          draggingCourse = "";
          draggingFolder = "";
          clearCourseDropMarks();
          request.then(loadList).catch(function (err) {
            courseTree.insertAdjacentHTML(
              "beforeend",
              '<p class="academy-status error">' + escapeHtml(err.message) + "</p>"
            );
          });
        });

        root.querySelector("#academy-thumbs").addEventListener("click", function (ev) {
          const thumb = ev.target.closest("[data-index]");
          if (!thumb) {
            return;
          }
          setSlide(Number(thumb.getAttribute("data-index")));
        });

        root.querySelector("#academy-viewer").addEventListener("click", function (ev) {
          const fsNav = ev.target.closest("[data-fs]");
          if (fsNav) {
            setSlide(pageNo + Number(fsNav.getAttribute("data-fs")));
            return;
          }
          if (ev.target.closest("#academy-stage") || ev.target.id === "academy-slide-img") {
            enterFs();
          }
        });

        function onKey(ev) {
          const fs = root.querySelector("#academy-fs");
          if (!fs || fs.hidden) {
            return;
          }
          if (ev.key === "Escape") {
            exitFs();
            return;
          }
          if (ev.key === "ArrowLeft") {
            setSlide(pageNo - 1);
          }
          if (ev.key === "ArrowRight") {
            setSlide(pageNo + 1);
          }
        }
        document.addEventListener("keydown", onKey);

        root.addEventListener("contextmenu", function (ev) {
          if (ev.target.closest(".academy-thumbs") || ev.target.closest(".academy-deck") || ev.target.closest(".academy-fs")) {
            ev.preventDefault();
          }
        });
        root.addEventListener("dragstart", function (ev) {
          if (ev.target.closest(".academy-thumbs") || ev.target.closest(".academy-deck") || ev.target.closest(".academy-fs")) {
            ev.preventDefault();
          }
        });

        return function () {
          dead = true;
          document.removeEventListener("keydown", onKey);
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
              '<p class="academy-empty">点左侧一档查看考试内容。导入试卷请到「文件上传」。</p></div></section></div>' +
              examUploadPaneHtml(),
            chromeTabs()
          )
        );
        let dead = false;
        let trackId = "";
        let timer = null;
        let remain = 0;
        let ticking = false;
        const showView = bindAcademyChrome(root, "academy-view-exams");

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
              '<p class="academy-empty">点左侧一档查看考试内容。导入试卷请到「文件上传」。</p>';
          }
        }

        function collectAnswers() {
          const answers = {};
          root.querySelectorAll(".academy-q").forEach(function (box) {
            const index = box.getAttribute("data-index");
            if (!index) {
              return;
            }
            const hit = box.querySelector("input:checked");
            const text = box.querySelector("textarea, input[type='text']");
            if (hit) {
              answers[index] = hit.value;
            } else if (text) {
              answers[index] = text.value;
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
                (track.graders && track.graders.length ? " · " + escapeHtml(track.graders.join("、")) + "阅卷" : "") +
                (track.paperReady ? " · 已导入 " + escapeHtml(track.importedQuestions) + " 题" : " · 待导入") +
                "</p></button>"
              );
            })
            .join("");
          const sel = root.querySelector("#academy-exam-track");
          if (sel) {
            const keep = sel.value || trackId;
            sel.innerHTML = (tracks || [])
              .map(function (track) {
                return (
                  '<option value="' +
                  escapeHtml(track.id) +
                  '">' +
                  escapeHtml(track.name) +
                  (track.paperReady ? "（已导入）" : "（待导入）") +
                  "</option>"
                );
              })
              .join("");
            if (keep) {
              sel.value = keep;
            }
          }
        }

        function graderHint(track) {
          const seats = (track && track.graders) || [];
          if (!seats.length) {
            return "";
          }
          return "问答题由" + seats.join("、") + "共同打分";
        }

        function typeLabel(type) {
          if (type === "fill") {
            return "填空";
          }
          if (type === "qa") {
            return "问答";
          }
          if (type === "multi") {
            return "多选";
          }
          return "选择";
        }

        function questionHtml(list) {
          return (list || [])
            .map(function (item) {
              const type = item.type || (item.options && item.options.length ? "choice" : "qa");
              let body = "";
              if (type === "choice" || type === "multi") {
                body = (item.options || [])
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
              } else if (type === "fill") {
                body =
                  '<input type="text" name="q-' +
                  escapeHtml(item.index) +
                  '" class="academy-fill" autocomplete="off" />';
              } else {
                body =
                  '<textarea name="q-' +
                  escapeHtml(item.index) +
                  '" class="academy-qa" rows="5"></textarea>';
              }
              return (
                '<div class="academy-q" data-index="' +
                escapeHtml(item.index) +
                '" data-type="' +
                escapeHtml(type) +
                '"><p><strong>' +
                escapeHtml(item.index) +
                ". [" +
                typeLabel(type) +
                "] " +
                escapeHtml(item.stem) +
                "</strong></p>" +
                body +
                "</div>"
              );
            })
            .join("");
        }

        function showResult(result) {
          stopTimer();
          const paper = root.querySelector("#academy-paper");
          const pending = result.status === "grading";
          const rows = (result.detail || [])
            .map(function (item) {
              const type = item.type || "choice";
              const mark =
                type === "qa" ? (pending ? "待阅" : "已阅") : item.ok ? "对" : "错";
              return (
                "<li>" +
                escapeHtml(item.index) +
                ". [" +
                typeLabel(type) +
                "] " +
                mark +
                " · 你的 " +
                escapeHtml(item.picked || "未答") +
                "</li>"
              );
            })
            .join("");
          paper.innerHTML =
            "<h2>成绩</h2><p class=\"academy-meta\">" +
            (pending
              ? "客观题 " +
                escapeHtml(result.score) +
                " 分，问答题待" +
                escapeHtml((result.pendingSeats || []).join("、") || "阅卷人") +
                "共同打分后出总分"
              : escapeHtml(result.score) +
                " 分 · " +
                (result.passed ? "及格" : "未及格") +
                " · 客观题对 " +
                escapeHtml(result.correct) +
                " / " +
                escapeHtml(result.total)) +
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

        function paintGrade(id, seats, track) {
          const box = root.querySelector("#academy-exam-grade");
          if (!box) {
            return;
          }
          api("/api/academy/exams/attempts?trackId=" + encodeURIComponent(id)).then(function (data) {
            if (dead || trackId !== id) {
              return;
            }
            const items = data.items || [];
            const pending = items.filter(function (item) {
              return item.status === "grading";
            });
            const finished = items.filter(function (item) {
              return item.status === "done";
            });
            let html = "";
            if (!pending.length) {
              html +=
                '<p class="academy-meta">暂无待阅答卷。问答题由' +
                escapeHtml((track.graders || seats).join("、")) +
                "各打一次分，取平均后出总分。</p>";
            } else {
              html +=
                "<h3>待阅卷</h3>" +
                pending
                  .map(function (item) {
                    const qa = (item.detail || []).filter(function (q) {
                      return q.grade === "dual" || q.type === "qa";
                    });
                    const fields = qa
                      .map(function (q) {
                        return (
                          '<label class="academy-grade-q">第 ' +
                          escapeHtml(q.index) +
                          " 题（满分 " +
                          escapeHtml(q.points) +
                          "）" +
                          "<p>" +
                          escapeHtml(q.stem) +
                          "</p><p class=\"academy-meta\">答：" +
                          escapeHtml(q.picked || "未答") +
                          '</p><input type="number" min="0" max="' +
                          escapeHtml(q.points) +
                          '" step="0.5" data-q="' +
                          escapeHtml(q.index) +
                          '" /></label>'
                        );
                      })
                      .join("");
                    const seatOpts = seats
                      .map(function (seat) {
                        const used = item.grades && item.grades[seat];
                        return (
                          '<option value="' +
                          escapeHtml(seat) +
                          '"' +
                          (used ? " disabled" : "") +
                          ">" +
                          escapeHtml(seat) +
                          (used ? "（已评）" : "") +
                          "</option>"
                        );
                      })
                      .join("");
                    return (
                      '<form class="academy-grade" data-attempt="' +
                      escapeHtml(item.id) +
                      '"><p><strong>' +
                      escapeHtml(item.displayName || item.username) +
                      "</strong> · 客观题 " +
                      escapeHtml(item.autoScore) +
                      " 分 · 待 " +
                      escapeHtml((item.pendingSeats || []).join("、")) +
                      '</p><label>以谁的身份打分 <select name="seat">' +
                      seatOpts +
                      "</select></label>" +
                      fields +
                      '<label>评语 <input name="comment" maxlength="400" /></label>' +
                      '<button type="submit">提交阅卷</button></form>'
                    );
                  })
                  .join("");
            }
            if (finished.length) {
              html +=
                "<h3>已出分</h3><ul class=\"academy-empty\">" +
                finished
                  .map(function (item) {
                    const seatsLine = Object.keys(item.grades || {})
                      .map(function (seat) {
                        return seat + " " + escapeHtml((item.grades[seat] && item.grades[seat].by) || "");
                      })
                      .join("、");
                    return (
                      "<li>" +
                      escapeHtml(item.displayName || item.username) +
                      " · 总分 " +
                      escapeHtml(item.score) +
                      " · 客观 " +
                      escapeHtml(item.autoScore) +
                      " · 问答 " +
                      escapeHtml(item.dualScore) +
                      (item.passed ? " · 及格" : " · 未及格") +
                      (seatsLine ? " · " + seatsLine : "") +
                      "</li>"
                    );
                  })
                  .join("") +
                "</ul>";
            }
            box.innerHTML = html;
            box.querySelectorAll("form.academy-grade").forEach(function (form) {
              form.addEventListener("submit", function (ev) {
                ev.preventDefault();
                const scores = {};
                form.querySelectorAll("[data-q]").forEach(function (input) {
                  scores[input.getAttribute("data-q")] = input.value;
                });
                postJson(
                  "/api/academy/exams/attempts/" + encodeURIComponent(form.getAttribute("data-attempt")) + "/grade",
                  {
                    seat: form.querySelector("[name=seat]").value,
                    scores: scores,
                    comment: form.querySelector("[name=comment]").value
                  }
                )
                  .then(function () {
                    return openTrack(id);
                  })
                  .catch(function (err) {
                    form.insertAdjacentHTML(
                      "beforeend",
                      '<p class="academy-status error">' + escapeHtml(err.message) + "</p>"
                    );
                  });
              });
            });
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
              const sel = root.querySelector("#academy-exam-track");
              if (sel) {
                sel.value = id;
              }
              const track = data.track || {};
              const pack = data.paper || {};
              const ready = Boolean(pack.ready);
              const types = pack.types || {};
              const typeLine = ready
                ? "选择 " +
                  (types.choice || 0) +
                  " · 填空 " +
                  (types.fill || 0) +
                  " · 问答 " +
                  (types.qa || 0) +
                  " · "
                : "";
              paper.innerHTML =
                "<h2>" +
                escapeHtml(track.name) +
                '</h2><p class="academy-meta">' +
                (ready
                  ? "已导入 " +
                    escapeHtml(pack.questionCount) +
                    " 题 · " +
                    typeLine +
                    escapeHtml(track.minutes) +
                    " 分钟 · 及格 " +
                    escapeHtml(track.passScore) +
                    " · " +
                    escapeHtml(graderHint(track))
                  : "还没有考试文档，请到「文件上传」导入 Word，不必套选择题模板") +
                "</p>" +
                (ready
                  ? '<div class="academy-actions"><button type="button" id="academy-exam-start">开始考试</button></div>'
                  : "") +
                '<div id="academy-exam-grade"></div>' +
                '<div id="academy-exam-take"></div>';
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
              const gradeSeats = data.gradeSeats || [];
              if (gradeSeats.length) {
                paintGrade(id, gradeSeats, track);
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
          const id = btn.getAttribute("data-id");
          const sel = root.querySelector("#academy-exam-track");
          if (sel) {
            sel.value = id;
          }
          showView("home");
          openTrack(id);
        });
        const examForm = root.querySelector("#academy-exam-upload");
        if (examForm) {
          examForm.addEventListener("submit", function (ev) {
            ev.preventDefault();
            const status = root.querySelector("#academy-exam-status");
            const fd = new FormData(examForm);
            const id = String(fd.get("trackId") || "");
            status.textContent = "正在解析…";
            status.className = "academy-status";
            postForm("/api/academy/exams/papers", fd)
              .then(function () {
                return api("/api/academy/exams/tracks").then(function (list) {
                  if (!dead) {
                    renderTracks(list.tracks);
                  }
                  showView("home");
                  if (id) {
                    return openTrack(id);
                  }
                });
              })
              .catch(function (err) {
                status.textContent = err.message;
                status.className = "academy-status error";
              });
          });
        }
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
        let draggingId = "";
        let didDrag = false;

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
                '" data-node="' +
                escapeHtml(node.id) +
                '">' +
                '<div class="academy-tree-row"' +
                (editorOk ? ' draggable="true"' : "") +
                ">" +
                '<button type="button" class="academy-tree-item' +
                (top ? " is-group" : "") +
                (node.id === currentId ? " is-on" : "") +
                '" data-id="' +
                escapeHtml(node.id) +
                '"' +
                (editorOk ? ' draggable="true"' : "") +
                ">" +
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
          setConsoleView(root, logsOn ? "logs" : "home");
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
            showLogs(true);
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
          if (didDrag) {
            didDrag = false;
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

        function clearDropMarks() {
          root.querySelectorAll(".academy-tree-row").forEach(function (el) {
            el.classList.remove("is-drop-before", "is-drop-after");
          });
        }

        function rowNodeId(row) {
          const item = row && row.querySelector("[data-id]");
          return item ? item.getAttribute("data-id") : "";
        }

        function movePayload(row, ev) {
          const group = row.closest(".academy-tree-group");
          const targetId = rowNodeId(row);
          const payload = { id: draggingId };
          const dragGroup = treeNav.querySelector('.academy-tree-group[data-node="' + draggingId + '"]');
          if (group && dragGroup && group !== dragGroup && group.contains(dragGroup)) {
            payload.parentId = targetId;
            const kids = group.querySelector(".academy-tree-kids");
            const first = kids ? kids.querySelector(":scope > .academy-tree-group") : null;
            const firstId = first ? first.getAttribute("data-node") : "";
            if (firstId && firstId !== draggingId) {
              payload.beforeId = firstId;
            }
            return payload;
          }
          const parentGroup = group && group.parentElement ? group.parentElement.closest(".academy-tree-group") : null;
          const parentId = parentGroup ? parentGroup.getAttribute("data-node") : "";
          const rect = row.getBoundingClientRect();
          const after = ev.clientY > rect.top + rect.height / 2;
          if (after) {
            const next = group && group.nextElementSibling;
            if (next && next.classList.contains("academy-tree-group")) {
              payload.beforeId = next.getAttribute("data-node");
            } else {
              payload.parentId = parentId;
            }
          } else {
            payload.beforeId = targetId;
          }
          return payload;
        }

        function postMove(payload) {
          return postJson("/api/academy/handbook/reorder", payload).catch(function (err) {
            if (String(err.message || "").indexOf("404") < 0) {
              throw err;
            }
            return postJson("/api/academy/handbook/sections/" + encodeURIComponent(payload.id), {
              move: true,
              beforeId: payload.beforeId || "",
              parentId: payload.parentId || ""
            });
          });
        }

        const treeNav = root.querySelector("#academy-tree");
        treeNav.addEventListener("dragstart", function (ev) {
          if (!editorOk || ev.target.closest("[data-add]") || ev.target.closest("form")) {
            ev.preventDefault();
            return;
          }
          const row = ev.target.closest(".academy-tree-row");
          const id = rowNodeId(row);
          if (!id) {
            ev.preventDefault();
            return;
          }
          draggingId = id;
          didDrag = true;
          window.clearTimeout(clickTimer);
          ev.dataTransfer.effectAllowed = "move";
          ev.dataTransfer.setData("text/plain", id);
        });
        treeNav.addEventListener("dragend", function () {
          draggingId = "";
          clearDropMarks();
        });
        treeNav.addEventListener("dragover", function (ev) {
          if (!draggingId) {
            return;
          }
          const row = ev.target.closest(".academy-tree-row");
          if (!row) {
            return;
          }
          ev.preventDefault();
          clearDropMarks();
          const rect = row.getBoundingClientRect();
          row.classList.add(ev.clientY > rect.top + rect.height / 2 ? "is-drop-after" : "is-drop-before");
        });
        treeNav.addEventListener("drop", function (ev) {
          const row = ev.target.closest(".academy-tree-row");
          if (!row || !draggingId) {
            return;
          }
          ev.preventDefault();
          const payload = movePayload(row, ev);
          draggingId = "";
          clearDropMarks();
          if (!payload.id || payload.beforeId === payload.id) {
            return;
          }
          postMove(payload)
            .then(function () {
              return loadTree().then(function () {
                if (currentId) {
                  root.querySelectorAll(".academy-tree-item").forEach(function (el) {
                    el.classList.toggle("is-on", el.getAttribute("data-id") === currentId);
                  });
                }
              });
            })
            .catch(function (err) {
              const tree = root.querySelector("#academy-tree");
              tree.querySelectorAll(".academy-status.error").forEach(function (el) {
                el.parentNode.removeChild(el);
              });
              tree.insertAdjacentHTML(
                "beforeend",
                '<p class="academy-status error">' + escapeHtml(err.message) + "</p>"
              );
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
