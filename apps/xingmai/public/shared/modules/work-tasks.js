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
    var old = document.getElementById("work-task-style");
    if (old && old.dataset.version === "chat-input-1") return;
    if (old) old.remove();
    var style = document.createElement("style");
    style.id = "work-task-style";
    style.dataset.version = "chat-input-1";
    style.textContent =
      ".wt-nav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.wt-badge{border-radius:8px;padding:2px 8px;background:#eef3ff;color:#2f6bff;font-weight:650}.wt-badge[data-status='已完成']{background:#e8f8ee;color:#1faa5a}.wt-badge[data-status='已退回']{background:#ffecec;color:#cf1322}.wt-badge[data-status='待检查']{background:#fff3e6;color:#f08a1e}.wt-overdue{color:#cf1322;font-weight:650}.wt-log{margin:8px 0 0;padding:0;list-style:none}.wt-log li{padding:8px 0;border-top:1px solid var(--l,#e8eef8)}.wt-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.wt-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wt-layout{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:12px}@media(max-width:980px){.wt-grid,.wt-layout{grid-template-columns:1fr}}";
    style.textContent += ".wt-attachments{margin:10px 0 14px;padding:12px;border:1px dashed var(--xm-line,#cbdaf0);border-radius:8px;background:var(--xm-card,#fff);color:var(--xm-ink,#163568)}.wt-attachments:focus-within{border-color:var(--xm-primary,#1677ff)}.wt-attachments input{max-width:100%}.wt-attachment-title{display:block;font-size:13px;margin-bottom:8px}.wt-paste-hint{margin:8px 0;color:var(--xm-muted,#62718a);font-size:12px;line-height:1.6}.wt-paste-hint kbd{border:1px solid var(--xm-line,#cbdaf0);border-radius:4px;padding:1px 5px;font:inherit}.wt-previews{display:flex;gap:10px;flex-wrap:wrap}.wt-file-card{display:flex;align-items:center;gap:10px;max-width:100%;padding:8px;border:1px solid var(--xm-line,#cbdaf0);border-radius:8px;box-sizing:border-box}.wt-file-card img,.wt-file-icon{width:80px;height:64px;object-fit:contain;border-radius:4px;background:var(--xm-bg,#f4f7fc)}.wt-file-icon{display:grid;place-items:center;font-size:13px}.wt-file-info{display:flex;flex-direction:column;gap:5px;min-width:0;max-width:200px;font-size:12px}.wt-file-info span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wt-file-info small,.wt-file-message{color:var(--xm-muted,#62718a)}.wt-file-message{margin-top:8px;font-size:12px;line-height:1.5}.wt-file-message.is-error{color:#cf1322}@media(max-width:600px){.wt-file-card{width:100%}.wt-file-info{flex:1}}";
    style.textContent += ".wt-rich-field{margin-top:10px}.wt-editor{min-height:116px;padding:10px;border:1px solid var(--xm-ui-border-strong,#cadbf7);border-radius:8px;background:var(--xm-ui-surface,#fff);color:var(--xm-ui-text,#163568);font-size:14px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}.wt-editor:focus{outline:2px solid var(--xm-ui-primary,#1677ff);outline-offset:1px}.wt-editor:empty:before{content:attr(data-placeholder);color:var(--xm-ui-text-muted,#73839e);pointer-events:none}.wt-rich-hint{color:var(--xm-ui-text-muted,#73839e);font-size:12px}.wt-inline-image{display:block;position:relative;width:fit-content;max-width:100%;margin:8px 0;line-height:0;white-space:normal}.wt-inline-image img{display:block;max-width:100%;max-height:240px;object-fit:contain;border:1px solid var(--xm-ui-border-strong,#cadbf7);border-radius:6px;cursor:zoom-in}.wt-inline-image button{position:absolute;right:6px;top:6px;border:0;border-radius:4px;background:rgba(15,23,42,.8);color:white;padding:6px 8px;cursor:pointer;font-size:12px;line-height:1.2}.wt-rich-content{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7}.wt-rich-message{color:#cf1322;font-size:12px;min-height:18px;margin:4px 0}.wt-image-viewer{padding:0;border:0;border-radius:12px;width:min(1200px,94vw);max-width:94vw;max-height:94vh;background:var(--xm-ui-surface,#fff);color:var(--xm-ui-text,#163568)}.wt-image-viewer::backdrop{background:rgba(0,0,0,.72)}.wt-viewer-bar{display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--xm-ui-border-strong,#cadbf7)}.wt-viewer-bar strong{flex:1}.wt-viewer-body{overflow:auto;max-height:80vh;padding:12px;text-align:center}.wt-viewer-body img{max-width:100%;max-height:76vh;object-fit:contain}.wt-image-viewer.is-original .wt-viewer-body img{max-width:none;max-height:none}.wt-image-viewer.is-original .wt-viewer-body{text-align:left}";
    style.textContent += ".wt-editor-label{display:flex;align-items:center;justify-content:space-between;gap:10px}.wt-rich-field [data-editor-message]{font-size:12px;line-height:1.5}.wt-rich-field [data-editor-message]:empty{display:none}";
    style.textContent += ".wt-compose{border:1px solid var(--xm-ui-border-strong,#cadbf7);border-radius:10px;background:var(--xm-ui-surface,#fff);overflow:hidden;cursor:text}.wt-compose:focus-within{border-color:#1677ff;box-shadow:0 0 0 2px #1677ff20}.wt-rich-field .wt-compose-text{display:block;width:100%;min-height:112px;max-height:320px;margin:0;border:0!important;border-radius:0;background:transparent!important;color:var(--xm-ui-text,#163568);padding:12px;font:inherit;line-height:1.7;resize:vertical;outline:none!important;box-shadow:none!important;user-select:text;-webkit-user-select:text;cursor:text}.wt-compose-images{display:flex;flex-wrap:wrap;gap:10px;padding:0 12px 12px}.wt-compose-images:empty{display:none}.wt-compose-image{position:relative;width:120px;height:92px}.wt-compose-preview{display:flex;align-items:center;justify-content:center;width:100%;height:100%;border:1px solid var(--xm-ui-border-strong,#cadbf7);border-radius:8px;background:var(--xm-ui-surface,#fff);padding:5px;cursor:zoom-in;font-size:12px}.wt-compose-preview img{display:block;max-width:100%;max-height:100%;object-fit:contain}.wt-compose-preview img:not([src]){display:none}.wt-compose-remove{position:absolute;right:-5px;top:-5px;width:24px;height:24px;border:1px solid white;border-radius:50%;background:#27384f;color:white;font-size:18px;line-height:18px;cursor:pointer}.wt-compose-button{border:1px solid var(--xm-ui-border-strong,#cadbf7);border-radius:6px;background:var(--xm-ui-surface,#fff);color:var(--xm-ui-text,#163568);padding:4px 10px;font:inherit;font-size:12px;cursor:pointer}.wt-editor-label{margin-bottom:6px}.wt-rich-hint{display:block;margin-top:6px}html[data-theme=dark] .wt-compose{background:#202e42;border-color:#425674}html[data-theme=dark] .wt-rich-field .wt-compose-text{color:#dce7f7}";
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
    label=esc(label); name=esc(name); max=Number(max)||4000;
    return '<div class="work-field wt-rich-field"><div class="wt-editor-label"><label for="wt-input-' + name + '">' + label + '</label><button type="button" class="wt-compose-button" data-rich-paste="' + name + '">粘贴图片</button></div><div class="wt-compose"><textarea class="wt-compose-text" id="wt-input-' + name + '" name="' + name + '" data-rich-editor="' + name + '" maxlength="' + max + '" rows="4" placeholder="输入文字，或按 Ctrl+V 粘贴图片" aria-describedby="wt-paste-status-' + name + '"></textarea><div class="wt-compose-images" data-rich-images aria-label="已添加的图片"></div></div><span class="wt-rich-hint">可直接打字、粘贴文字和图片 · 图片可点击放大或删除 · 最多 ' + max + ' 字</span><span data-editor-message id="wt-paste-status-' + name + '" role="status" aria-live="polite"></span></div>';
  }

  function zoomImage(host, src, name) {
    if (!/^data:image\/(png|jpeg|gif|webp|bmp);base64,/i.test(src || "") && !String(src||"").startsWith("/api/work/center/image/")) return;
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
    if (!form || form._wtRichPayload) return;
    var editors = [].slice.call(form.querySelectorAll('[data-rich-editor]'));
    var serial = 0;
    function attachments() {
      var input = form.querySelector('[name="files"]');
      return input ? [].slice.call(input._wtFiles || input.files || []) : [];
    }
    function busy() { return !!form.querySelector('[type="submit"]:disabled'); }
    function tell(editor, text, error) {
      var node = editor.closest('.wt-rich-field').querySelector('[data-editor-message]');
      node.textContent = text || '';
      node.style.color = error ? '#cf1322' : 'var(--xm-ui-text-muted,#73839e)';
    }
    function normalizeImage(file, hint) {
      if (!file || !file.size) return null;
      var type = String(file.type || hint || '').toLowerCase();
      type = { 'image/x-png': 'image/png', 'image/jpg': 'image/jpeg', 'image/x-ms-bmp': 'image/bmp' }[type] || type;
      if (!type || type === 'application/octet-stream') {
        type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }[String(file.name || '').split('.').pop().toLowerCase()] || type;
      }
      if (!/^image\/(png|jpeg|gif|webp|bmp)$/.test(type)) return null;
      var extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp' }[type];
      return new File([file], file.name || '粘贴图片-' + (++serial) + '.' + extension, { type: type });
    }
    function allEntries() { return editors.reduce(function (all, editor) { return all.concat(editor._wtImages || []); }, []); }
    form._wtInlineFiles = function () { return allEntries().map(function (entry) { return entry.file; }); };
    function draw(editor) {
      var box = editor.closest('.wt-rich-field').querySelector('[data-rich-images]');
      box.replaceChildren();
      editor._wtImages.forEach(function (entry) {
        var card = document.createElement('div'); card.className = 'wt-compose-image';
        var preview = document.createElement('button'); preview.type = 'button'; preview.className = 'wt-compose-preview';
        preview.setAttribute('aria-label', '放大图片：' + entry.file.name);
        var img = document.createElement('img'); img.alt = entry.file.name;
        if (entry.src) img.src = entry.src;
        else preview.textContent = entry.error ? '读取失败' : '正在读取…';
        preview.appendChild(img); preview.disabled = !entry.src;
        preview.addEventListener('click', function () {
          zoomImage(form, entry.src, entry.file.name);
          form.querySelector('.wt-image-viewer').addEventListener('close', function () { editor.focus({ preventScroll: true }); }, { once: true });
        });
        var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'wt-compose-remove'; remove.textContent = '×';
        remove.setAttribute('aria-label', '删除图片：' + entry.file.name);
        remove.addEventListener('click', function () {
          if (busy()) return;
          editor._wtImages = editor._wtImages.filter(function (item) { return item !== entry; });
          draw(editor); tell(editor, '图片已删除', false); editor.focus({ preventScroll: true });
        });
        card.append(preview, remove); box.appendChild(card);
      });
    }
    function addImages(editor, files) {
      if (!files.length || !editor.isConnected || busy()) return;
      var reserved=editors.flatMap(function(e){return Array.from({length:e._wtLoadCount||0},function(){return {size:1};});});
      var error = attachmentError(attachments().concat(form._wtInlineFiles(), reserved, files));
      if (error) { tell(editor, '图片和附件合计' + error.replace('最多上传', '最多'), true); return; }
      files.forEach(function (file) {
        var entry = { file: file, src: '', error: false }; editor._wtImages.push(entry);
        var reader = new FileReader();
        reader.onload = function () {
          entry.src = String(reader.result);
          if (editor.isConnected && editor._wtImages.includes(entry)) { draw(editor); tell(editor, '已添加图片，文字和图片将一起提交', false); }
        };
        reader.onerror = function () { entry.error = true; if (editor.isConnected) { draw(editor); tell(editor, '图片读取失败，请删除后重新粘贴', true); } };
        reader.readAsDataURL(file);
      });
      draw(editor);
    }
    function insertText(editor, text) {
      if (!text) return;
      // Only mixed image/text paste needs manual insertion. Ordinary typing, IME and text paste remain native.
      var start = editor.selectionStart, end = editor.selectionEnd;
      var room = editor.maxLength - (editor.value.length - (end - start));
      editor.setRangeText(text.slice(0, Math.max(0, room)), start, end, 'end');
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    async function readClipboard(editor) {
      if (!navigator.clipboard || !navigator.clipboard.read) { tell(editor, '请复制图片后在输入框中按 Ctrl+V', true); return; }
      if (editor._wtReading) return;
      editor._wtReading = true;
      tell(editor, '正在读取剪贴板图片…', false);
      var attempt = ++editor._wtAttempt;
      try {
        var items = await Promise.race([navigator.clipboard.read(), new Promise(function (_, reject) { editor._wtTimer = setTimeout(function () { reject(new Error('读取超时')); }, 6000); })]);
        var files = [];
        for (var i = 0; i < items.length; i++) {
          var type = items[i].types.find(function (value) { return /^image\/(png|jpeg|gif|webp|bmp)$/.test(value); });
          if (type) { var file = normalizeImage(await items[i].getType(type), type); if (file) files.push(file); }
        }
        if (!editor.isConnected || attempt !== editor._wtAttempt) return;
        if (files.length) addImages(editor, files);
        else tell(editor, '剪贴板中没有图片，请复制图片后再粘贴', true);
      } catch (_) {
        if (editor.isConnected && attempt === editor._wtAttempt) tell(editor, '无法读取剪贴板，请允许剪贴板访问，或在输入框中按 Ctrl+V', true);
      } finally { clearTimeout(editor._wtTimer); if (attempt === editor._wtAttempt) editor._wtReading = false; }
    }
    async function readHtmlImages(editor, sources) {
      var attempt = ++editor._wtAttempt;
      editor._wtReading = true; tell(editor, '正在读取复制的图片…', false);
      try {
        if (sources.length + attachments().length + form._wtInlineFiles().length > 3) throw new Error('图片和附件合计最多 3 个');
        var files = await Promise.all(sources.map(async function (src) {
          // Clipboard HTML is never inserted. Read image bytes only; do not send site credentials.
          if (!/^data:image\/(png|jpeg|gif|webp|bmp);base64,/i.test(src) && !/^https?:\/\//i.test(src)) throw new Error('请右键复制图片后粘贴，或使用截图');
          if (src.length > 4.3 * 1024 * 1024) throw new Error('图片和附件合计最多 3 MB');
          var res = await fetch(src, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(6000) });
          if (!res.ok) throw new Error('无法读取网页图片，请右键复制图片后粘贴，或使用截图');
          var file = normalizeImage(await res.blob());
          if (!file) throw new Error('请复制 PNG、JPG、GIF、WebP 或 BMP 图片');
          return file;
        }));
        if (attempt === editor._wtAttempt) addImages(editor, files);
      } catch (error) { if (editor.isConnected && attempt === editor._wtAttempt) tell(editor, error.message || '无法读取网页图片，请右键复制图片后粘贴', true); }
      finally { if (attempt === editor._wtAttempt) editor._wtReading = false; }
    }
    form._wtSetImages = async function (name, images, source) {
      var editor=editors.find(function(e){return e.dataset.richEditor===name;});if(!editor)return;
      var generation=(editor._wtLoadGeneration||0)+1;editor._wtLoadGeneration=generation;editor._wtLoading=true;editor._wtLoadError=false;editor._wtLoadCount=images.length;editor._wtImages=[];draw(editor);
      try {
        var files=await Promise.all(images.map(async function(image){var response=await fetch(await source(image),{credentials:'same-origin'});if(!response.ok)throw new Error('图片加载失败');return normalizeImage(await response.blob(),image.mime);}));
        if(editor.isConnected&&generation===editor._wtLoadGeneration){editor._wtLoadCount=0;addImages(editor,files);}
      } catch(error){tell(editor,error.message,true);editor._wtLoadError=true;}
      finally{if(generation===editor._wtLoadGeneration){editor._wtLoading=false;editor._wtLoadCount=0;}}
    };
    form._wtComposerPayload = function () {
      form._wtRichPayload();
      return editors.flatMap(function(editor){return editor._wtImages.map(function(entry){return {field:editor.getAttribute('data-label')||editor.dataset.richEditor,name:entry.file.name,mime:entry.file.type,data:entry.src.split(',')[1]};});});
    };
    form._wtRichPayload = function () {
      if (editors.some(function(editor){return editor._wtLoadError;})) throw new Error('原有图片未能载入，请关闭后重试，以免丢失图片');
      if (editors.some(function (editor) { return editor._wtReading || editor._wtLoading; })) throw new Error('图片正在读取，请稍候再提交');
      var images = allEntries(), attached = attachments(), files = attached.concat(images.map(function (entry) { return entry.file; }));
      var error = attachmentError(files); if (error) throw new Error(error);
      if (images.some(function (entry) { return !entry.src || entry.error; })) throw new Error('图片尚未读取完成，请稍候或删除后重新粘贴');
      var fields = {};
      editors.forEach(function (editor) {
        var name = editor.dataset.richEditor, text = editor.value;
        if (text.length > editor.maxLength) throw new Error('文字超过上限，请精简后再提交');
        fields[name] = text;
        fields[name + '_doc'] = JSON.stringify((text ? [{ type: 'text', text: text }] : []).concat(editor._wtImages.map(function (entry) { return { type: 'image', upload: attached.length + images.indexOf(entry) }; })));
      });
      return { files: files, fields: fields };
    };
    editors.forEach(function (editor) {
      editor._wtImages = []; editor._wtAttempt = 0; editor._wtReading = false;
      var field = editor.closest('.wt-rich-field');
      field.querySelector('[data-rich-paste]').addEventListener('click', function () { if (!busy()) { editor.focus({ preventScroll: true }); readClipboard(editor); } });
      editor.addEventListener('paste', function (event) {
        if (busy()) { event.preventDefault(); return; }
        var data = event.clipboardData; if (!data) return;
        var files = [].slice.call(data.items || []).filter(function (item) { return item.kind === 'file'; }).map(function (item) { return normalizeImage(item.getAsFile(), item.type); }).filter(Boolean);
        if (!files.length) files = [].slice.call(data.files || []).map(function (file) { return normalizeImage(file); }).filter(Boolean);
        var text = data.getData('text/plain'), html = data.getData('text/html');
        var sources = [];
        if (!files.length && html) {
          var parsed = new DOMParser().parseFromString(html, 'text/html');
          sources = [].slice.call(parsed.querySelectorAll('img[src]')).map(function (img) { return img.getAttribute('src'); });
        }
        if (files.length || sources.length) {
          event.preventDefault(); event.stopPropagation();
          ++editor._wtAttempt; editor._wtReading = false; clearTimeout(editor._wtTimer);
          insertText(editor, text);
          if (files.length) addImages(editor, files); else readHtmlImages(editor, sources);
        } else if (!text) {
          event.preventDefault(); event.stopPropagation(); readClipboard(editor);
        }
        // Do not cancel native text paste or intercept keyboard/composition events.
      });
      field.querySelector('.wt-compose').addEventListener('dragover', function (event) { if ([].slice.call(event.dataTransfer.types || []).includes('Files')) event.preventDefault(); });
      field.querySelector('.wt-compose').addEventListener('drop', function (event) {
        var raw = [].slice.call(event.dataTransfer.files || []); if (!raw.length) return;
        event.preventDefault(); event.stopPropagation();
        var files = raw.map(function (file) { return normalizeImage(file); }).filter(Boolean);
        if (files.length !== raw.length) tell(editor, '这里可拖入图片，其他文件请在附件中上传', true);
        else addImages(editor, files);
        editor.focus({ preventScroll: true });
      });
    });
  }

  function upgradeEditors(form) {
    [].slice.call(form.querySelectorAll('textarea:not([data-rich-editor])')).forEach(function(old){
      if(old.name==='links')return;
      var wrapper=old.closest('.wc-field'), label=wrapper && wrapper.querySelector('span');
      var holder=document.createElement('div');holder.innerHTML=richEditor(label?label.textContent:old.name,old.name,old.maxLength>0?old.maxLength:old.name==='reason'?500:['criteria','note'].includes(old.name)?2000:4000);
      var replacement=holder.firstElementChild,editor=replacement.querySelector('textarea');
      [].slice.call(old.attributes).forEach(function(a){if(!['class','id','placeholder'].includes(a.name))editor.setAttribute(a.name,a.value);});
      editor.value=old.value;
      if(wrapper && wrapper.tagName==='LABEL') {
        var outer=document.createElement('div');outer.className=wrapper.className;outer.appendChild(replacement);wrapper.replaceWith(outer);
      } else old.replaceWith(replacement);
    });
    bindRichEditors(form);
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
  window.XmWorkRich = { version: "chat-input-1", editor: richEditor, bind: bindRichEditors, style: ensureStyle, upgrade: upgradeEditors, preview: zoomImage };
})();
