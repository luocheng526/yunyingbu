/* 工作汇报里的发布任务、我的任务、待检查任务。 */
(function () {
  var queues = { taskPublish: "publish", taskMine: "mine", taskReview: "review" };
  var labels = { start: "开始执行", submit: "提交检查", approve: "检查通过", return: "退回修改" };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function xm() {
    return window.XmUI;
  }

  function uiButton(label, attrs, options) {
    var item = { label: label, size: "small", type: "button" };
    if (options) Object.keys(options).forEach(function (key) { item[key] = options[key]; });
    var html = xm().button(item);
    return attrs ? html.replace("<button ", "<button " + attrs + " ") : html;
  }

  function statusTone(status) {
    if (status === "已完成") return "success";
    if (status === "已退回") return "danger";
    if (status === "待检查" || status === "进行中") return "warning";
    return "blue";
  }

  function ensureStyle() {
    if (document.getElementById("work-task-style")) return;
    var style = document.createElement("style");
    style.id = "work-task-style";
    style.textContent =
      ".wt-nav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.wt-badge{border-radius:8px;padding:2px 8px;background:#eef3ff;color:#2f6bff;font-weight:650}.wt-badge[data-status='已完成']{background:#e8f8ee;color:#1faa5a}.wt-badge[data-status='已退回']{background:#ffecec;color:#cf1322}.wt-badge[data-status='待检查']{background:#fff3e6;color:#f08a1e}.wt-overdue{color:#cf1322;font-weight:650}.wt-log{margin:8px 0 0;padding:0;list-style:none}.wt-log li{padding:8px 0;border-top:1px solid var(--l,#e8eef8)}.wt-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.wt-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wt-layout{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:12px}@media(max-width:980px){.wt-grid,.wt-layout{grid-template-columns:1fr}}";
    style.textContent += ".wt-attachments{margin:10px 0 14px;padding:12px;border:1px dashed var(--xm-line,#cbdaf0);border-radius:8px;background:var(--xm-card,#fff);color:var(--xm-ink,#163568)}.wt-attachments:focus-within{border-color:var(--xm-primary,#1677ff)}.wt-attachments input{max-width:100%}.wt-attachment-title{display:block;font-size:13px;margin-bottom:8px}.wt-paste-hint{margin:8px 0;color:var(--xm-muted,#62718a);font-size:12px;line-height:1.6}.wt-paste-hint kbd{border:1px solid var(--xm-line,#cbdaf0);border-radius:4px;padding:1px 5px;font:inherit}.wt-previews{display:flex;gap:10px;flex-wrap:wrap}.wt-file-card{display:flex;align-items:center;gap:10px;max-width:100%;padding:8px;border:1px solid var(--xm-line,#cbdaf0);border-radius:8px;box-sizing:border-box}.wt-file-card img,.wt-file-icon{width:80px;height:64px;object-fit:contain;border-radius:4px;background:var(--xm-bg,#f4f7fc)}.wt-file-icon{display:grid;place-items:center;font-size:13px}.wt-file-info{display:flex;flex-direction:column;gap:5px;min-width:0;max-width:200px;font-size:12px}.wt-file-info span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wt-file-info small,.wt-file-message{color:var(--xm-muted,#62718a)}.wt-file-message{margin-top:8px;font-size:12px;line-height:1.5}.wt-file-message.is-error{color:#cf1322}@media(max-width:600px){.wt-file-card{width:100%}.wt-file-info{flex:1}}";
    style.textContent += ".wt-rich-field{margin-top:10px}.wt-editor{min-height:116px;padding:10px;border:1px solid var(--xm-ui-border-strong,#cadbf7);border-radius:8px;background:var(--xm-ui-surface,#fff);color:var(--xm-ui-text,#163568);font-size:14px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}.wt-editor:focus{outline:2px solid var(--xm-ui-primary,#1677ff);outline-offset:1px}.wt-editor:empty:before{content:attr(data-placeholder);color:var(--xm-ui-text-muted,#73839e);pointer-events:none}.wt-rich-hint{color:var(--xm-ui-text-muted,#73839e);font-size:12px}.wt-inline-image{display:block;position:relative;width:fit-content;max-width:100%;margin:8px 0;line-height:0;white-space:normal}.wt-inline-image img{display:block;max-width:100%;max-height:240px;object-fit:contain;border:1px solid var(--xm-ui-border-strong,#cadbf7);border-radius:6px;cursor:zoom-in}.wt-inline-image button{position:absolute;right:6px;top:6px;border:0;border-radius:4px;background:rgba(15,23,42,.8);color:white;padding:6px 8px;cursor:pointer;font-size:12px;line-height:1.2}.wt-rich-content{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7}.wt-rich-message{color:#cf1322;font-size:12px;min-height:18px;margin:4px 0}.wt-image-viewer{padding:0;border:0;border-radius:12px;width:min(1200px,94vw);max-width:94vw;max-height:94vh;background:var(--xm-ui-surface,#fff);color:var(--xm-ui-text,#163568)}.wt-image-viewer::backdrop{background:rgba(0,0,0,.72)}.wt-viewer-bar{display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--xm-ui-border-strong,#cadbf7)}.wt-viewer-bar strong{flex:1}.wt-viewer-body{overflow:auto;max-height:80vh;padding:12px;text-align:center}.wt-viewer-body img{max-width:100%;max-height:76vh;object-fit:contain}.wt-image-viewer.is-original .wt-viewer-body img{max-width:none;max-height:none}.wt-image-viewer.is-original .wt-viewer-body{text-align:left}";
    style.textContent += ".wt-editor-label{display:flex;align-items:center;justify-content:space-between;gap:10px}.wt-rich-field [data-editor-message]{font-size:12px;line-height:1.5}.wt-rich-field [data-editor-message]:empty{display:none}";
    document.head.appendChild(style);
  }

  function api(path, options) {
    var init = options || {};
    var headers = { Accept: "application/json" };
    if (init.json) headers["Content-Type"] = "application/json";
    return fetch("/api/work/" + path, {
      method: init.method || "GET",
      credentials: "same-origin",
      headers: headers,
      body: init.json ? JSON.stringify(init.json) : init.body
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || data.ok === false) throw new Error((data && data.error) || "读取失败");
        return data;
      });
    });
  }

  function stamp(value) {
    return esc(String(value || "").slice(0, 16).replace("T", " "));
  }

  function overdue(task, now) {
    return ["待执行", "进行中", "已退回"].indexOf(task.status) >= 0 && Date.parse(task.due_at + "+08:00") < now;
  }

  function attachmentError(files) {
    if (files.length > 3 || files.reduce(function (sum, file) { return sum + file.size; }, 0) > 3 * 1024 * 1024) {
      return "最多上传 3 个附件，合计 3 MB；请先移除附件后重试";
    }
    return files.some(function (file) { return !file.size; }) ? "请移除空文件" : "";
  }

  function bindAttachments(form) {
    if (!form) return;
    var input = form.querySelector('[name="files"]');
    var area = form.querySelector('[data-task-attachments]');
    var preview = form.querySelector('[data-task-previews]');
    var message = form.querySelector('[data-task-file-message]');
    var entries = [];
    var sequence = 0;
    input._wtFiles = [];

    function busy() {
      return form.querySelector('[type="submit"]').disabled;
    }

    function tell(text, error) {
      message.textContent = text;
      message.className = "wt-file-message" + (error ? " is-error" : "");
    }

    function render() {
      input._wtFiles = entries.map(function (entry) { return entry.file; });
      preview.innerHTML = entries.map(function (entry) {
        return '<div class="wt-file-card">' + (entry.url
          ? '<img src="' + esc(entry.url) + '" alt="' + esc(entry.file.name) + '">'
          : '<span class="wt-file-icon">' + (/^image\//i.test(entry.file.type) ? "图片" : "文件") + '</span>') +
          '<div class="wt-file-info"><span title="' + esc(entry.file.name) + '">' + esc(entry.file.name) + '</span><small>' + Math.max(1, Math.ceil(entry.file.size / 1024)) + ' KB</small></div>' +
          uiButton("移除", 'data-task-remove-file="' + entry.id + '" aria-label="移除：' + esc(entry.file.name) + '"', { variant: "secondary" }) + '</div>';
      }).join("");
    }

    function add(files, pasted) {
      if (!files.length || busy()) return;
      var error = attachmentError(input._wtFiles.concat(form._wtInlineFiles ? form._wtInlineFiles() : [], files));
      if (error) {
        tell(error + "，原有附件已保留。", true);
        return;
      }
      files.forEach(function (file) {
        sequence += 1;
        if (pasted) {
          var extension = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/bmp": "bmp" }[file.type.toLowerCase()] || "png";
          file = new File([file], "粘贴图片-" + Date.now() + "-" + sequence + "." + extension, { type: file.type });
        }
        var entry = { id: sequence, file: file, url: "" };
        entries.push(entry);
        // Preview raster images only; all attachments still use the existing upload API.
        if (/^image\/(png|jpeg|gif|webp|bmp)$/i.test(file.type)) {
          var reader = new FileReader();
          reader.onload = function () {
            if (entries.indexOf(entry) < 0 || !form.isConnected) return;
            entry.url = reader.result;
            render();
          };
          reader.onerror = function () {
            if (entries.indexOf(entry) < 0 || !form.isConnected) return;
            tell("图片预览读取失败，可移除后重新添加。", true);
          };
          reader.readAsDataURL(file);
        }
      });
      render();
      tell((pasted ? "已粘贴 " : "已添加 ") + files.length + " 个附件，共 " + entries.length + "/3 个；发布任务时一并上传。", false);
    }

    input.addEventListener("change", function () {
      add([].slice.call(input.files || []), false);
      input.value = "";
    });
    preview.addEventListener("click", function (event) {
      var button = event.target.closest('[data-task-remove-file]');
      if (!button || busy()) return;
      var id = Number(button.getAttribute("data-task-remove-file"));
      entries = entries.filter(function (entry) { return entry.id !== id; });
      render();
      tell("已移除附件，剩余 " + entries.length + "/3 个。", false);
      area.focus();
    });
    form.addEventListener("paste", function (event) {
      var target = event.target;
      if (!area.contains(target)) return;
      var clipboard = event.clipboardData;
      if (!clipboard) return;
      var images = [].slice.call(clipboard.items || []).filter(function (item) {
        return item.kind === "file" && /^image\//i.test(item.type);
      }).map(function (item) { return item.getAsFile(); }).filter(Boolean);
      if (!images.length) images = [].slice.call(clipboard.files || []).filter(function (file) { return /^image\//i.test(file.type); });
      if (!images.length) return;
      // Keep native text insertion (including the caret/maxlength rules) for mixed clipboard content.
      if (!target.matches("textarea") || !clipboard.getData("text/plain") || busy()) event.preventDefault();
      add(images, true);
    });
  }

  function richEditor(label, name, max) {
    return '<div class="work-field wt-rich-field"><div class="wt-editor-label"><span id="wt-label-' + name + '">' + label + '</span>' + uiButton("粘贴截图", 'data-rich-paste="' + name + '"', { variant: "secondary" }) + '</div><input type="hidden" name="' + name + '"><div class="wt-editor" data-rich-editor="' + name + '" data-max-text="' + max + '" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="wt-label-' + name + '" aria-describedby="wt-paste-status-' + name + '" data-placeholder="在这里输入文字、粘贴图片；图片可点击放大"></div><span class="wt-rich-hint">支持 Ctrl+V 粘贴截图，也可点上方“粘贴截图” · 图片点击放大 · 最多 ' + max + ' 字</span><span data-editor-message id="wt-paste-status-' + name + '" role="status" aria-live="polite"></span></div>';
  }

  function zoomImage(host, src, name) {
    if (!/^data:image\/(png|jpeg|gif|webp|bmp);base64,/i.test(src || "")) return;
    var dialog = document.createElement("dialog");
    dialog.className = "wt-image-viewer";
    dialog.setAttribute("aria-label", "图片放大查看");
    dialog.innerHTML = '<div class="wt-viewer-bar"><strong>图片预览</strong>' + uiButton("查看原图", "data-original", { variant: "secondary" }) + uiButton("关闭", "data-image-close", { variant: "secondary" }) + '</div><div class="wt-viewer-body"><img alt="' + esc(name || "正文图片") + '"></div>';
    dialog.querySelector("img").src = src;
    host.appendChild(dialog);
    dialog.addEventListener("close", function () { dialog.remove(); });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog || event.target.closest("[data-image-close]")) dialog.close();
      if (event.target.closest("[data-original]")) {
        var original = dialog.classList.toggle("is-original");
        dialog.querySelector("[data-original]").textContent = original ? "适应屏幕" : "查看原图";
      }
    });
    dialog.showModal();
  }

  function bindRichEditors(form) {
    if (!form) return;
    var entries = {};
    var serial = 0;
    var editors = [].slice.call(form.querySelectorAll("[data-rich-editor]"));
    var message = form.querySelector("[data-rich-message]");
    var clipboardReads = 0;
    function sayRich(text) { message.textContent = text || ""; }
    function sayEditor(editor, text, error) {
      var node = editor.parentElement.querySelector("[data-editor-message]");
      node.textContent = text || "";
      node.style.color = error ? "#cf1322" : "var(--xm-ui-text-muted,#73839e)";
    }
    function editorRange(editor, preferred) {
      var selection = window.getSelection();
      var current = selection.rangeCount ? selection.getRangeAt(0) : null;
      function belongs(range) { return range && editor.contains(range.startContainer) && editor.contains(range.endContainer); }
      var range = belongs(preferred) ? preferred : belongs(current) ? current : belongs(editor._wtRange) ? editor._wtRange : null;
      if (!range) { range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); }
      editor.focus();
      selection.removeAllRanges(); selection.addRange(range);
      return range;
    }
    function insertAtCaret(editor, value, html, marker) {
      var range = editorRange(editor);
      var done = false;
      try { done = document.execCommand(html ? "insertHTML" : "insertText", false, value); } catch (_) { /* Range insertion below handles unsupported editing commands. */ }
      if (html ? !editor.querySelector('[data-inline-key="' + marker + '"]') : !done) {
        range = editorRange(editor, range);
        var content;
        if (html) { var template = document.createElement("template"); template.innerHTML = value; content = template.content; }
        else content = document.createTextNode(value);
        var tail = content.lastChild || content;
        range.deleteContents(); range.insertNode(content); range.setStartAfter(tail); range.collapse(true);
        var selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      }
      editor._wtRange = window.getSelection().getRangeAt(0).cloneRange();
    }
    function clipboardImage(file, hint) {
      if (!file) return null;
      var type = String(file.type || hint || "").toLowerCase();
      type = { "image/x-png": "image/png", "image/jpg": "image/jpeg", "image/x-ms-bmp": "image/bmp" }[type] || type;
      if (!type || type === "application/octet-stream") {
        var extension = String(file.name || "").split(".").pop().toLowerCase();
        type = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" }[extension] || type;
      }
      if (!/^image\/(png|jpeg|gif|webp|bmp)$/.test(type)) return null;
      return type === file.type ? file : new File([file], file.name || "截图.png", { type: type });
    }
    function referenced() {
      return [].slice.call(form.querySelectorAll("[data-inline-key]")).map(function (node) { return node.getAttribute("data-inline-key"); }).filter(function (key, index, keys) { return entries[key] && keys.indexOf(key) === index; });
    }
    form._wtInlineFiles = function () { return referenced().map(function (key) { return entries[key].file; }); };
    function insertImages(editor, files, text) {
      var error = attachmentError(form.querySelector('[name="files"]')._wtFiles.concat(form._wtInlineFiles(), files));
      if (error) { sayEditor(editor, "正文图片和附件" + error.replace("最多上传", "最多共用"), true); return; }
      if (files.some(function (file) { return !/^image\/(png|jpeg|gif|webp|bmp)$/i.test(file.type); })) {
        sayEditor(editor, "请粘贴 PNG、JPG、GIF、WebP 或 BMP 图片。", true); return;
      }
      if (text) insertAtCaret(editor, text, false);
      files.forEach(function (file) {
        var key = "inline-" + (++serial);
        var extension = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/bmp": "bmp" }[file.type.toLowerCase()];
        entries[key] = { file: new File([file], key + "." + extension, { type: file.type }), ready: false };
        insertAtCaret(editor, '<span class="wt-inline-image" contenteditable="false" data-inline-key="' + key + '"><img alt="正文图片，点击放大" data-wt-zoom role="button" tabindex="0"><button type="button" data-inline-remove aria-label="移除正文图片">移除图片</button></span><span>\u200b</span>', true, key);
        var reader = new FileReader();
        reader.onload = function () {
          entries[key].ready = true;
          entries[key].src = reader.result;
          var node = editor.querySelector('[data-inline-key="' + key + '"] img');
          if (node) node.src = reader.result;
        };
        reader.onerror = function () { sayEditor(editor, "图片读取失败，请移除后重新粘贴。", true); };
        reader.readAsDataURL(file);
      });
      sayRich("");
      sayEditor(editor, "已在正文插入 " + files.length + " 张图片，可继续打字或点击图片放大。", false);
    }
    async function readScreenshot(editor, preferredRange) {
      if (editor._wtClipboardReading) return;
      if (!navigator.clipboard || !navigator.clipboard.read) {
        sayEditor(editor, "浏览器不支持直接读取截图，请重新截图后点击正文按 Ctrl+V。", true); return;
      }
      var range = editorRange(editor, preferredRange).cloneRange();
      editor._wtClipboardReading = true; clipboardReads += 1;
      sayEditor(editor, "正在读取截图；如浏览器询问，请允许访问剪贴板。", false);
      var timeout;
      try {
        var items = await Promise.race([
          navigator.clipboard.read(),
          new Promise(function (_, reject) { timeout = setTimeout(function () { reject(new Error("clipboard-timeout")); }, 12000); })
        ]);
        var files = [];
        for (var i = 0; i < items.length; i += 1) {
          var type = items[i].types.indexOf("image/png") >= 0 ? "image/png" : items[i].types.find(function (value) { return /^image\/(jpeg|gif|webp|bmp)$/.test(value); });
          if (type) { var file = clipboardImage(await items[i].getType(type), type); if (file) files.push(file); }
        }
        if (!editor.isConnected) return;
        if (!files.length) { sayEditor(editor, "剪贴板中没有可读取的截图，请在截图工具中点击“复制”，再粘贴。", true); return; }
        editorRange(editor, range);
        insertImages(editor, files, "");
      } catch (_) {
        if (editor.isConnected) sayEditor(editor, "未能读取截图。请点击“粘贴截图”并允许剪贴板访问，或重新截图后按 Ctrl+V。", true);
      } finally {
        clearTimeout(timeout); editor._wtClipboardReading = false; clipboardReads -= 1;
      }
    }
    function serialize(editor, uploadKeys, attachmentCount) {
      var nodes = [];
      function text(value) {
        value = value.replace(/\u200b/g, "");
        if (!value) return;
        var last = nodes[nodes.length - 1];
        if (last && last.type === "text") last.text += value;
        else nodes.push({ type: "text", text: value });
      }
      function walk(node) {
        if (node.nodeType === 3) { text(node.textContent); return; }
        if (node.nodeType !== 1) return;
        var key = node.getAttribute("data-inline-key");
        if (key) {
          if (!entries[key] || !entries[key].ready) throw new Error("正文图片仍在读取或读取失败，请稍候或移除后重新粘贴");
          nodes.push({ type: "image", upload: attachmentCount + uploadKeys.indexOf(key) });
          return;
        }
        if (node.tagName === "BR") { text("\n"); return; }
        var block = /^(DIV|P|LI)$/.test(node.tagName);
        var last = nodes[nodes.length - 1];
        if (block && last && !(last.type === "text" && /\n$/.test(last.text))) text("\n");
        [].slice.call(node.childNodes).forEach(walk);
        if (block && node.nextSibling) text("\n");
      }
      [].slice.call(editor.childNodes).forEach(walk);
      var plain = nodes.filter(function (node) { return node.type === "text"; }).map(function (node) { return node.text; }).join("");
      if (plain.length > Number(editor.getAttribute("data-max-text"))) throw new Error("文字超过上限，请精简后再发布");
      return { nodes: nodes, text: plain };
    }
    form._wtRichPayload = function () {
      if (clipboardReads) throw new Error("正在读取剪贴板图片，请稍候再发布");
      var attachments = form.querySelector('[name="files"]')._wtFiles;
      var keys = referenced();
      var files = attachments.concat(form._wtInlineFiles());
      var error = attachmentError(files);
      if (error) throw new Error(error);
      var fields = {};
      editors.forEach(function (editor) {
        var name = editor.getAttribute("data-rich-editor");
        var doc = serialize(editor, keys, attachments.length);
        fields[name] = doc.text;
        fields[name + "_doc"] = JSON.stringify(doc.nodes);
      });
      return { files: files, fields: fields };
    };
    editors.forEach(function (editor) {
      var pasteButton = editor.parentElement.querySelector("[data-rich-paste]");
      pasteButton.addEventListener("mousedown", function (event) { event.preventDefault(); });
      pasteButton.addEventListener("click", function () {
        if (!form.querySelector('[type="submit"]').disabled) readScreenshot(editor, editor._wtRange);
      });
      ["keyup", "mouseup", "blur"].forEach(function (eventName) {
        editor.addEventListener(eventName, function () {
          var selection = window.getSelection();
          if (selection.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) editor._wtRange = selection.getRangeAt(0).cloneRange();
        });
      });
      editor.addEventListener("paste", function (event) {
        event.preventDefault();
        var data = event.clipboardData;
        if (form.querySelector('[type="submit"]').disabled) return;
        var files = [].slice.call((data && data.items) || []).filter(function (item) { return item.kind === "file"; }).map(function (item) { return clipboardImage(item.getAsFile(), item.type); }).filter(Boolean);
        if (!files.length) files = [].slice.call((data && data.files) || []).map(function (file) { return clipboardImage(file); }).filter(Boolean);
        var text = data ? data.getData("text/plain") : "";
        try {
          if (files.length) insertImages(editor, files, text);
          else if (text) { insertAtCaret(editor, text, false); sayEditor(editor, "", false); }
          else readScreenshot(editor);
        } catch (_) { sayEditor(editor, "截图未能插入，请点击正文后重新粘贴。", true); }
      });
      // Browser-dropped HTML must never create arbitrary elements in the editor.
      editor.addEventListener("drop", function (event) { event.preventDefault(); sayRich("请复制图片后在正文中粘贴。"); });
      editor.addEventListener("click", function (event) {
        var remove = event.target.closest("[data-inline-remove]");
        if (!remove || form.querySelector('[type="submit"]').disabled) return;
        var image = remove.closest("[data-inline-key]");
        editor.focus();
        var range = document.createRange(); range.selectNode(image);
        var selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        document.execCommand("delete", false);
        sayRich("");
      });
      editor.addEventListener("input", function () {
        editor.querySelectorAll("[data-inline-key] img").forEach(function (img) {
          var entry = entries[img.parentElement.getAttribute("data-inline-key")];
          if (entry && entry.src) img.src = entry.src;
        });
      });
    });
  }

  function richImageIds(task) {
    return [].concat(task.description_doc || [], task.criteria_doc || []).filter(function (node) { return node.type === "image"; }).map(function (node) { return node.fileId; });
  }

  function richContentHtml(doc, fallback, task) {
    if (!Array.isArray(doc)) return '<div class="wt-rich-content">' + esc(fallback || "—") + '</div>';
    return '<div class="wt-rich-content">' + doc.map(function (node) {
      if (node.type === "text") return esc(node.text);
      if (node.type === "image" && (task.files || []).some(function (file) { return file.id === node.fileId; })) {
        return '<span class="wt-inline-image" data-rich-file="' + esc(node.fileId) + '"><img alt="正在加载正文图片" data-wt-zoom role="button" tabindex="0"></span>';
      }
      return "";
    }).join("") + '</div>';
  }

  function mount(host, tab, openId) {
    ensureStyle();
    var queue = queues[tab] || "mine";
    var mode = queue === "publish" ? "发布任务" : queue === "review" ? "待检查" : "全部任务";
    var filter = "";
    var items = [];
    var ctx = { me: "", people: [], today: "" };
    var formKey = "";
    host.innerHTML = xm().EmptyState({ title: "正在读取任务" });

    function labelOf(person) {
      return person && person.name === "管理员" ? "罗成" : person.name;
    }

    function name(id) {
      var hit = ctx.people.find(function (person) { return person.id === id; });
      return hit ? labelOf(hit) : id;
    }

    function matches(task, chosen, now) {
      if (queue === "publish" || chosen === "全部任务") return true;
      if (chosen === "已逾期") return overdue(task, now);
      if (chosen === "已处理") {
        return task.status !== "待检查" && (task.events || []).some(function (event) {
          return event.actor === ctx.me && (event.action === "检查通过" || event.action === "退回修改");
        });
      }
      return task.status === chosen;
    }

    function options(selected) {
      return '<option value="">请选择</option>' + ctx.people.map(function (person) {
        return '<option value="' + esc(person.id) + '"' + (person.id === selected ? " selected" : "") + ">" + esc(labelOf(person)) + "</option>";
      }).join("");
    }

    function draw() {
      if (!host.isConnected) return;
      var now = Date.now();
      var nav = queue === "publish" ? ["发布任务", "已发布任务"] : queue === "review" ? ["待检查", "已处理"] : ["全部任务", "已逾期", "待执行", "进行中", "待检查", "已退回", "已完成"];
      var chips = xm().FilterToolbar({
        tabs: nav.map(function (item) {
          var count = items.filter(function (task) { return matches(task, item, now); }).length;
          var showCount = queue === "mine" && item !== "全部任务" && item !== "已完成" || (queue === "review" && item === "待检查");
          return { label: item + (showCount ? " " + count : ""), value: item, active: item === mode };
        }),
        search: false
      }).replace(/data-xm-ui-tab="([^"]*)"/g, 'data-xm-ui-tab="$1" data-task-tab="$1"');
      var body = mode === "发布任务" ? compose() : list(now);
      var priority = "";
      if (queue === "mine") {
        var urgent = items.filter(function (task) { return task.status === "已退回" || task.status === "待检查"; });
        priority = xm().ContentCard({
          title: "优先跟进",
          content: urgent.length ? urgent.map(function (task) {
            return uiButton(task.status + " " + task.title, 'data-task-open="' + esc(task.id) + '"', { variant: "secondary" });
          }).join(" ") : xm().EmptyState({ title: "暂无已退回或待检查的任务" })
        });
      }
      host.innerHTML = chips + '<p class="work-msg" data-task-msg></p>' + (priority ? '<div class="wt-layout">' + body + priority + "</div>" : body);
      bindAttachments(host.querySelector('[data-task-form="publish"]'));
      bindRichEditors(host.querySelector('[data-task-form="publish"]'));
    }

    function compose() {
      if (!formKey) formKey = ("task" + Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 64);
      var nowDate = new Date();
      var pad = function (n) { return String(n).padStart(2, "0"); };
      var start = nowDate.getFullYear() + "-" + pad(nowDate.getMonth() + 1) + "-" + pad(nowDate.getDate()) + "T" + pad(nowDate.getHours()) + ":" + pad(nowDate.getMinutes());
      return '<form data-task-form="publish">' + xm().ContentCard({
        title: "发布任务",
        content: '<div class="wt-grid"><label class="work-field">任务标题<input name="title" required maxlength="200" placeholder="请输入任务标题"></label><label class="work-field">执行人<select name="assignee">' + options("") + '</select></label><label class="work-field">检查人<select name="reviewer">' + options("") + '</select></label><label class="work-field">计划开始<input name="start_at" type="datetime-local" required value="' + esc(start) + '"></label><label class="work-field">截止时间<input name="due_at" type="datetime-local" required value="' + esc(ctx.today) + 'T23:59"></label></div>' + richEditor("任务说明", "description", 4000) + richEditor("完成要求", "criteria", 2000) + '<div class="wt-rich-message" data-rich-message role="status" aria-live="polite"></div><div class="wt-attachments" data-task-attachments tabindex="0" role="group" aria-label="任务附件，可在此粘贴图片" aria-describedby="wt-paste-hint"><label class="work-field"><span class="wt-attachment-title">任务附件</span><input name="files" type="file" multiple></label><p class="wt-paste-hint" id="wt-paste-hint">单独上传的文件放在这里。正文图片与附件合计最多 3 个、3 MB；在此处粘贴图片会作为附件添加。</p><div class="wt-previews" data-task-previews></div><div class="wt-file-message" data-task-file-message role="status" aria-live="polite">尚未添加附件</div></div>' + uiButton("发布任务", "", { type: "submit" })
      }) + "</form>";
    }

    function list(now) {
      var shown = items.filter(function (task) {
        if (!matches(task, mode, now)) return false;
        var blob = [task.title, name(task.assignee), name(task.reviewer)].join(" ");
        return !filter || blob.indexOf(filter) >= 0;
      });
      var table = shown.length ? xm().DataTable({
        columns: [
          { key: "title", label: "任务标题" },
          { key: "assigneeName", label: "执行人" },
          { key: "reviewerName", label: "检查人" },
          { key: "due", label: "截止时间", render: function (value, row) { return value + (row.late ? ' <span class="wt-overdue">已逾期</span>' : ""); } },
          { key: "status", label: "状态", render: function (value) { return xm().StatusBadge({ label: value, tone: statusTone(value) }); } },
          { key: "id", label: "操作", render: function (value) { return uiButton("查看任务", 'data-task-open="' + esc(value) + '"', { variant: "secondary" }); } }
        ],
        rows: shown.map(function (task) {
          return {
            id: task.id,
            title: task.title,
            assigneeName: name(task.assignee),
            reviewerName: name(task.reviewer),
            due: stamp(task.due_at),
            late: overdue(task, now),
            status: task.status
          };
        })
      }) : xm().EmptyState({ title: "暂无记录" });
      return xm().ContentCard({
        title: queue === "review" ? "检查清单" : "任务清单",
        content: '<label class="work-field">找任务<input data-task-q value="' + esc(filter) + '" placeholder="搜索任务标题或人员"></label>' + table
      });
    }

    function say(text, error) {
      var node = host.querySelector("[data-task-msg]");
      if (!node) return;
      node.textContent = text || "";
      node.className = "work-msg" + (error ? " is-error" : "");
    }

    function checkFiles(input) {
      var files = [].slice.call((input && (input._wtFiles || input.files)) || []);
      var error = attachmentError(files);
      if (error) throw new Error(error);
      return files;
    }

    function postForm(path, fields, input) {
      return Promise.resolve().then(function () {
        var files = checkFiles(input);
        var body = new FormData();
        Object.keys(fields).forEach(function (key) { body.append(key, fields[key] == null ? "" : fields[key]); });
        files.forEach(function (file) { body.append("files", file, file.name); });
        return api(path, { method: "POST", body: body });
      });
    }

    function openTask(id) {
      var task = items.find(function (item) { return item.id === id; });
      if (!task) {
        say("没有这条任务，或当前账号不能处理", true);
        return;
      }
      var actions = [];
      if (task.assignee === ctx.me && task.status === "待执行") actions.push("start");
      if (task.assignee === ctx.me && ["待执行", "进行中", "已退回"].indexOf(task.status) >= 0) actions.push("submit");
      if (task.reviewer === ctx.me && task.status === "待检查") actions.push("approve", "return");
      var inlineIds = richImageIds(task);
      var files = (task.files || []).filter(function (file) { return inlineIds.indexOf(file.id) < 0; }).map(function (file) {
        return uiButton(file.name || "附件", 'data-task-file="' + esc(file.id) + '"', { variant: "secondary" });
      }).join(" ");
      var log = (task.events || []).map(function (event) {
        var eventFiles = (event.files || []).filter(function (file) { return inlineIds.indexOf(file.id) < 0; }).map(function (file) {
          return uiButton(file.name || "附件", 'data-task-file="' + esc(file.id) + '"', { variant: "secondary" });
        }).join(" ");
        return "<li><strong>" + esc(event.action) + "</strong> · " + esc(name(event.actor)) + " <small>" + stamp(event.at) + "</small>" + (event.note ? "<p>" + esc(event.note) + "</p>" : "") + eventFiles + "</li>";
      }).join("");
      var tools = actions.length
        ? '<label class="work-field">' + (actions.indexOf("submit") >= 0 ? "执行结果" : "检查意见") + '<textarea name="note" maxlength="2000"></textarea></label>' +
          (actions.indexOf("submit") >= 0 ? '<label class="work-field">执行结果附件<input name="files" type="file" multiple></label>' : "") +
          '<div class="wt-actions">' + actions.map(function (action) {
            return uiButton(labels[action], 'data-task-do="' + action + '"', action === "return" ? { variant: "secondary" } : {});
          }).join("") + "</div>"
        : "";
      var old = host.querySelector(".work-modal");
      if (old) old.remove();
      host.insertAdjacentHTML("beforeend", '<div class="work-modal"><div class="work-dialog">' + xm().ContentCard({
        title: task.title,
        content: xm().StatusBadge({ label: task.status, tone: statusTone(task.status) }) + "<p>执行人 " + esc(name(task.assignee)) + "　检查人 " + esc(name(task.reviewer)) + "</p><p>计划 " + stamp(task.start_at) + " 至 " + stamp(task.due_at) + "</p><h3>任务说明</h3>" + richContentHtml(task.description_doc, task.description, task) + "<h3>完成要求</h3>" + richContentHtml(task.criteria_doc, task.criteria, task) + files + '<ol class="wt-log">' + log + "</ol>" + tools + uiButton("关闭", "data-task-close", { variant: "secondary" })
      }) + "</div></div>");
      var box = host.querySelector(".work-modal");
      box.querySelectorAll("[data-rich-file]").forEach(function (node) {
        api("tasks/file?id=" + encodeURIComponent(node.getAttribute("data-rich-file"))).then(function (file) {
          if (!node.isConnected) return;
          if (!/^image\/(png|jpeg|gif|webp|bmp)$/.test(file.mime || "")) throw new Error("图片格式无效");
          var img = node.querySelector("img");
          img.src = "data:" + file.mime + ";base64," + file.data;
          img.alt = "正文图片，点击放大";
        }).catch(function () { node.textContent = "图片暂时无法加载，请关闭任务后重试"; });
      });
      box.addEventListener("click", function (event) {
        if (event.target === box || event.target.closest("[data-task-close]")) box.remove();
        var file = event.target.closest("[data-task-file]");
        if (file) download(file.getAttribute("data-task-file"));
        var action = event.target.closest("[data-task-do]");
        if (!action || action.disabled) return;
        action.disabled = true;
        var note = (box.querySelector("[name=note]") || {}).value || "";
        var fileInput = box.querySelector("[name=files]");
        postForm("tasks/action", { id: task.id, revision: task.revision, action: action.getAttribute("data-task-do"), note: note }, fileInput).then(function () {
          box.remove();
          return reload("任务状态已更新");
        }).catch(function (err) {
          action.disabled = false;
          say(err.message, true);
        });
      });
    }

    function download(id) {
      api("tasks/file?id=" + encodeURIComponent(id)).then(function (file) {
        var bytes = Uint8Array.from(atob(file.data || ""), function (ch) { return ch.charCodeAt(0); });
        var link = document.createElement("a");
        var url = URL.createObjectURL(new Blob([bytes]));
        link.href = url;
        link.download = file.name || "附件";
        link.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      }).catch(function (err) { say(err.message, true); });
    }

    function reload(message) {
      if (mode === "发布任务") {
        draw();
        if (message) say(message, false);
        return Promise.resolve();
      }
      var queueName = queue === "publish" ? "published" : queue;
      return api("tasks?queue=" + queueName).then(function (data) {
        items = data.rows || [];
        draw();
        if (message) say(message, false);
      });
    }

    host.addEventListener("keydown", function (event) {
      if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-wt-zoom]")) {
        event.preventDefault(); zoomImage(host, event.target.src, event.target.alt);
      }
    });
    host.addEventListener("click", function (event) {
      var image = event.target.closest("[data-wt-zoom]");
      if (image) { zoomImage(host, image.src, image.alt); return; }
      var chip = event.target.closest("[data-task-tab]");
      if (chip) {
        mode = chip.getAttribute("data-task-tab");
        reload().catch(function (err) { say(err.message, true); });
        return;
      }
      var open = event.target.closest("[data-task-open]");
      if (open) openTask(open.getAttribute("data-task-open"));
    });
    host.addEventListener("input", function (event) {
      if (!event.target.matches("[data-task-q]")) return;
      filter = event.target.value.trim();
      draw();
      var box = host.querySelector("[data-task-q]");
      if (box) {
        box.focus();
        box.setSelectionRange(filter.length, filter.length);
      }
    });
    host.addEventListener("submit", function (event) {
      var form = event.target.closest("[data-task-form]");
      if (!form) return;
      event.preventDefault();
      var button = form.querySelector("[type=submit]");
      if (button) button.disabled = true;
      var rich;
      try { rich = form._wtRichPayload(); } catch (err) {
        if (button) button.disabled = false;
        form.querySelector("[data-rich-message]").textContent = err.message;
        return;
      }
      var data = {
        id: formKey,
        title: form.elements.title.value,
        description: form.elements.description.value,
        criteria: form.elements.criteria.value,
        assignee: form.elements.assignee.value,
        reviewer: form.elements.reviewer.value,
        start_at: form.elements.start_at.value,
        due_at: form.elements.due_at.value
      };
      Object.assign(data, rich.fields);
      if (!data.assignee || !data.reviewer) {
        if (button) button.disabled = false;
        say("请选择执行人和检查人", true);
        return;
      }
      if (data.assignee === data.reviewer) {
        if (button) button.disabled = false;
        say("检查人和执行人必须为不同人员", true);
        return;
      }
      if (data.due_at < data.start_at) {
        if (button) button.disabled = false;
        say("截止时间不能早于开始时间", true);
        return;
      }
      postForm("tasks/publish", data, { _wtFiles: rich.files }).then(function () {
        mode = "已发布任务";
        return reload("任务已发布");
      }).then(function () {
        formKey = "";
      }).catch(function (err) {
        if (button) button.disabled = false;
        say(err.message, true);
      });
    });

    api("tasks/context").then(function (data) {
      ctx = data;
      if (!ctx.me) {
        host.innerHTML = xm().ContentCard({ title: "任务", content: xm().EmptyState({ title: "对不上组织中心的人，还不能收发任务。" }) });
        return;
      }
      return reload().then(function () {
        if (openId) openTask(openId);
      });
    }).catch(function (err) {
      host.innerHTML = xm().ContentCard({ title: "任务", content: xm().EmptyState({ title: err.message || "读取失败" }) });
    });
  }

  window.XmWorkTasks = { mount: mount };
})();
