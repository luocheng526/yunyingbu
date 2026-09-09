/* xm-module-agents 0.1.133 */
(function () {
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensureCss() {
    if (document.querySelector('link[href*="agents.css"]')) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/agents.css";
    document.head.appendChild(link);
  }

  function api(path, options) {
    return fetch(path, Object.assign({ credentials: "same-origin", headers: { Accept: "application/json" } }, options)).then(
      function (res) {
        return res.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!res.ok) {
            throw new Error(data.error || "接口 " + res.status);
          }
          return data;
        });
      }
    );
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/agents"] = {
    mount: function (root) {
      ensureCss();
      root.innerHTML =
        '<main class="page agents-page">' +
        '<header class="page-head"><p class="kicker">甄选智能体</p><h1>甄选智能体</h1>' +
        '<p class="lead">选品、做店、日常聊天走后台模型（配了密钥就是 GPT）。在职、店权走花名册。近30天、商学院课表、外数还没有，不会编。改价、退款、发版不会做。密钥不出前端。</p></header>' +
        '<div class="agents-workbench">' +
        '<aside class="agents-rail" aria-label="历史会话">' +
        "<h2>历史会话</h2>" +
        '<button type="button" class="agents-new" id="agents-new">新会话</button>' +
        '<ul class="agents-threads" id="agents-sessions"></ul>' +
        "</aside>" +
        '<section class="agents-chat" aria-label="主脑问答台">' +
        '<div class="agents-chat-head">' +
        "<div><h2 id=\"agents-chat-title\">主脑问答台</h2>" +
        '<p id="agents-chat-lead">选品、做店、日常可聊；花名册三件事仍走本站。模型在后台，下拉只选 modelId。</p></div>' +
        '<label class="agents-model">模型<select id="agents-model"></select></label></div>' +
        '<div class="agents-log" id="agents-log"><p class="agents-empty">正在打开会话…</p></div>' +
        '<p class="agents-status" id="agents-status" role="status"></p>' +
        '<div class="agents-files" id="agents-files"></div>' +
        '<form class="agents-composer" id="agents-form">' +
        '<label class="agents-upload">上传<input type="file" id="agents-file" /></label>' +
        '<textarea id="agents-text" name="text" rows="2" maxlength="2000" placeholder="像问主脑一样提问，回车发送，Shift+回车换行"></textarea>' +
        '<button type="submit" id="agents-send">发送</button></form>' +
        "</section></div></main>";

      const sessionsEl = root.querySelector("#agents-sessions");
      const titleEl = root.querySelector("#agents-chat-title");
      const leadEl = root.querySelector("#agents-chat-lead");
      const logEl = root.querySelector("#agents-log");
      const statusEl = root.querySelector("#agents-status");
      const filesEl = root.querySelector("#agents-files");
      const formEl = root.querySelector("#agents-form");
      const textEl = root.querySelector("#agents-text");
      const sendEl = root.querySelector("#agents-send");
      const newEl = root.querySelector("#agents-new");
      const modelEl = root.querySelector("#agents-model");
      const fileEl = root.querySelector("#agents-file");
      let dead = false;
      let models = [];
      let preferredModelId = "";
      let sessions = [];
      let current = null;
      let messages = [];
      let pendingFiles = [];

      function setStatus(message, isError) {
        statusEl.textContent = message || "";
        statusEl.className = "agents-status" + (isError ? " is-error" : "");
      }

      function modelId() {
        return modelEl.value || "desk";
      }

      function renderModels() {
        const currentId = modelEl.value;
        modelEl.innerHTML = models
          .map(function (item) {
            return (
              '<option value="' +
              escapeHtml(item.id) +
              '"' +
              (item.available ? "" : " disabled") +
              ">" +
              escapeHtml(item.label + (item.available ? "" : "（不可用）")) +
              "</option>"
            );
          })
          .join("");
        if (models.some(function (item) { return item.id === currentId && item.available; })) {
          modelEl.value = currentId;
        } else {
          const prefer = models.find(function (item) { return item.id === preferredModelId && item.available; });
          const first = models.find(function (item) { return item.available; });
          modelEl.value = (prefer || first || { id: "desk" }).id;
        }
      }

      function renderSessions() {
        if (!sessions.length) {
          sessionsEl.innerHTML = '<li class="agents-empty">还没有会话</li>';
          return;
        }
        sessionsEl.innerHTML = sessions
          .map(function (item) {
            const on = current && Number(current.id) === Number(item.id) ? " is-active" : "";
            return (
              '<li><button type="button" class="agents-thread' +
              on +
              '" data-session="' +
              escapeHtml(item.id) +
              '"><span class="name">' +
              escapeHtml(item.title) +
              '</span><span class="meta">' +
              escapeHtml(item.preview || item.updatedAt || "") +
              "</span></button></li>"
            );
          })
          .join("");
      }

      function renderFiles() {
        if (!pendingFiles.length) {
          filesEl.innerHTML = "";
          return;
        }
        filesEl.innerHTML = pendingFiles
          .map(function (item) {
            return (
              '<span class="agents-chip">#' +
              escapeHtml(item.id) +
              " " +
              escapeHtml(item.filename) +
              "</span>"
            );
          })
          .join("");
      }

      function renderMessages() {
        if (!current) {
          titleEl.textContent = "主脑问答台";
          leadEl.textContent = "选品、做店、日常可聊；花名册三件事仍走本站。";
          logEl.innerHTML = '<p class="agents-empty">点左侧新会话，或直接提问。</p>';
          return;
        }
        titleEl.textContent = current.title || "主脑问答台";
        leadEl.textContent = "后台模型聊运营；本店数字没有接口就不编。答案可引用文件 id。";
        if (!messages.length) {
          logEl.innerHTML = '<p class="agents-empty">开始提问。</p>';
          return;
        }
        logEl.innerHTML = messages
          .map(function (item) {
            const who = item.role === "user" ? "is-user" : "is-assistant";
            const cite =
              item.role === "assistant" && item.sources && item.sources.length
                ? '<div class="agents-cite">依据 ' + escapeHtml(item.sources.join("、")) + "</div>"
                : "";
            const files =
              item.fileIds && item.fileIds.length
                ? '<div class="agents-cite">文件 ' +
                  escapeHtml(item.fileIds.map(function (id) { return "#" + id; }).join(" ")) +
                  "</div>"
                : "";
            return '<div class="agents-bubble ' + who + '">' + escapeHtml(item.text) + files + cite + "</div>";
          })
          .join("");
        logEl.scrollTop = logEl.scrollHeight;
      }

      function paint() {
        renderModels();
        renderSessions();
        renderFiles();
        renderMessages();
      }

      function loadList() {
        return Promise.all([api("/api/agents/models"), api("/api/agents/sessions")]).then(function (pair) {
          if (dead) {
            return;
          }
          models = pair[0].models || [];
          preferredModelId = pair[0].defaultModelId || "";
          sessions = pair[1].sessions || [];
          paint();
        });
      }

      function openSession(id) {
        setStatus("正在打开…");
        return api("/api/agents/sessions/" + id).then(function (data) {
          if (dead) {
            return;
          }
          current = data.session;
          messages = data.messages || [];
          if (current && current.modelId) {
            modelEl.value = current.modelId;
          }
          setStatus("");
          paint();
        });
      }

      function startSession() {
        setStatus("正在开会话…");
        pendingFiles = [];
        return api("/api/agents/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ modelId: modelId() })
        }).then(function (data) {
          if (dead) {
            return;
          }
          current = data.session;
          messages = data.messages || [];
          setStatus("");
          return loadList();
        });
      }

      newEl.addEventListener("click", function () {
        startSession().catch(function (err) {
          if (!dead) {
            setStatus(err.message || "无法开会话", true);
          }
        });
      });

      sessionsEl.addEventListener("click", function (event) {
        const button = event.target.closest("[data-session]");
        if (!button) {
          return;
        }
        openSession(button.getAttribute("data-session")).catch(function (err) {
          if (!dead) {
            setStatus(err.message || "无法打开", true);
          }
        });
      });

      fileEl.addEventListener("change", function () {
        const file = fileEl.files && fileEl.files[0];
        fileEl.value = "";
        if (!file) {
          return;
        }
        setStatus("正在上传…");
        const body = new FormData();
        body.append("file", file, file.name);
        fetch("/api/agents/uploads", { method: "POST", credentials: "same-origin", body: body })
          .then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
              if (!res.ok) {
                throw new Error(data.error || "上传失败");
              }
              return data;
            });
          })
          .then(function (data) {
            if (dead) {
              return;
            }
            if (data.file) {
              pendingFiles.push(data.file);
            }
            setStatus("已上传 #" + data.file.id);
            renderFiles();
          })
          .catch(function (err) {
            if (!dead) {
              setStatus(err.message || "上传失败", true);
            }
          });
      });

      formEl.addEventListener("submit", function (event) {
        event.preventDefault();
        const text = textEl.value.trim();
        if (!text) {
          setStatus("请输入内容", true);
          return;
        }
        sendEl.disabled = true;
        setStatus("正在发送…");
        const payload = {
          sessionId: current ? current.id : undefined,
          modelId: modelId(),
          text: text,
          fileIds: pendingFiles.map(function (item) { return item.id; })
        };
        api("/api/agents/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload)
        })
          .then(function (data) {
            if (dead) {
              return;
            }
            textEl.value = "";
            pendingFiles = [];
            current = data.session;
            if (data.message && data.reply) {
              const already = messages.some(function (item) { return Number(item.id) === Number(data.message.id); });
              if (!already) {
                messages = messages.concat([data.message, data.reply]);
              }
            }
            setStatus("");
            return loadList();
          })
          .catch(function (err) {
            if (!dead) {
              setStatus(err.message || "发送失败", true);
            }
          })
          .then(function () {
            if (!dead) {
              sendEl.disabled = false;
              textEl.focus();
              paint();
            }
          });
      });

      textEl.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          formEl.requestSubmit();
        }
      });

      loadList()
        .then(function () {
          if (dead) {
            return;
          }
          if (sessions.length) {
            return openSession(sessions[0].id);
          }
          return startSession();
        })
        .catch(function (err) {
          if (!dead) {
            setStatus(err.message || "无法加载问答台", true);
          }
        });

      return function unmount() {
        dead = true;
        root.innerHTML = "";
      };
    }
  };
})();
