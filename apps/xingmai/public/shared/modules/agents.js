/* xm-module-agents 0.1.126 */
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
        '<p class="lead">智能体入口和工作台。点左侧开对话，记录写在本模块自己的表，不进人员/沈/韩的库。</p></header>' +
        '<div class="agents-workbench">' +
        '<aside class="agents-rail" aria-label="智能体入口">' +
        "<h2>智能体入口</h2>" +
        '<ul class="agents-catalog" id="agents-catalog"></ul>' +
        '<h2 class="agents-subhead">最近对话</h2>' +
        '<ul class="agents-threads" id="agents-threads"></ul>' +
        "</aside>" +
        '<section class="agents-chat" aria-label="对话工作台">' +
        '<div class="agents-chat-head">' +
        "<div><h2 id=\"agents-chat-title\">对话工作台</h2>" +
        '<p id="agents-chat-lead">从左侧选一个智能体，开始对话。</p></div>' +
        '<button type="button" class="agents-new" id="agents-new" hidden>新对话</button></div>' +
        '<div class="agents-log" id="agents-log"><p class="agents-empty">还没有打开的对话。</p></div>' +
        '<p class="agents-status" id="agents-status" role="status"></p>' +
        '<form class="agents-composer" id="agents-form">' +
        '<textarea id="agents-text" name="text" rows="2" maxlength="2000" placeholder="输入问题，回车发送，Shift+回车换行" disabled></textarea>' +
        '<button type="submit" id="agents-send" disabled>发送</button></form>' +
        "</section></div></main>";

      const catalogEl = root.querySelector("#agents-catalog");
      const threadsEl = root.querySelector("#agents-threads");
      const titleEl = root.querySelector("#agents-chat-title");
      const leadEl = root.querySelector("#agents-chat-lead");
      const logEl = root.querySelector("#agents-log");
      const statusEl = root.querySelector("#agents-status");
      const formEl = root.querySelector("#agents-form");
      const textEl = root.querySelector("#agents-text");
      const sendEl = root.querySelector("#agents-send");
      const newEl = root.querySelector("#agents-new");
      let dead = false;
      let agents = [];
      let threads = [];
      let current = null;
      let messages = [];

      function setStatus(message, isError) {
        statusEl.textContent = message || "";
        statusEl.className = "agents-status" + (isError ? " is-error" : "");
      }

      function findAgent(id) {
        return agents.find(function (item) {
          return item.id === id;
        });
      }

      function renderCatalog() {
        if (!agents.length) {
          catalogEl.innerHTML = '<li class="agents-empty">暂无智能体</li>';
          return;
        }
        catalogEl.innerHTML = agents
          .map(function (agent) {
            const on = current && current.agentId === agent.id ? " is-active" : "";
            return (
              '<li><button type="button" class="agents-card' +
              on +
              '" data-agent="' +
              escapeHtml(agent.id) +
              '"><span class="name">' +
              escapeHtml(agent.name) +
              '</span><span class="meta">' +
              escapeHtml(agent.summary) +
              "</span></button></li>"
            );
          })
          .join("");
      }

      function renderThreads() {
        if (!threads.length) {
          threadsEl.innerHTML = '<li class="agents-empty">还没有对话</li>';
          return;
        }
        threadsEl.innerHTML = threads
          .map(function (thread) {
            const on = current && Number(current.id) === Number(thread.id) ? " is-active" : "";
            return (
              '<li><button type="button" class="agents-thread' +
              on +
              '" data-thread="' +
              escapeHtml(thread.id) +
              '"><span class="name">' +
              escapeHtml(thread.title) +
              '</span><span class="meta">' +
              escapeHtml(thread.agentName + (thread.preview ? " · " + thread.preview : "")) +
              "</span></button></li>"
            );
          })
          .join("");
      }

      function renderMessages() {
        if (!current) {
          titleEl.textContent = "对话工作台";
          leadEl.textContent = "从左侧选一个智能体，开始对话。";
          newEl.hidden = true;
          textEl.disabled = true;
          sendEl.disabled = true;
          logEl.innerHTML = '<p class="agents-empty">还没有打开的对话。</p>';
          return;
        }
        const agent = findAgent(current.agentId);
        titleEl.textContent = current.title || (agent ? agent.name : "对话");
        leadEl.textContent = agent ? agent.hint : "";
        newEl.hidden = !agent;
        textEl.disabled = false;
        sendEl.disabled = false;
        if (!messages.length) {
          logEl.innerHTML = '<p class="agents-empty">开始输入，记录会留下来。</p>';
          return;
        }
        logEl.innerHTML = messages
          .map(function (item) {
            const who = item.role === "user" ? "is-user" : "is-assistant";
            return '<div class="agents-bubble ' + who + '">' + escapeHtml(item.text) + "</div>";
          })
          .join("");
        logEl.scrollTop = logEl.scrollHeight;
      }

      function paint() {
        renderCatalog();
        renderThreads();
        renderMessages();
      }

      function loadList() {
        return api("/api/agents").then(function (data) {
          if (dead) {
            return;
          }
          agents = data.agents || [];
          threads = data.threads || [];
          paint();
          if (!current && threads.length) {
            return openThread(threads[0].id);
          }
        });
      }

      function openThread(id) {
        setStatus("正在打开…");
        return api("/api/agents/threads/" + id).then(function (data) {
          if (dead) {
            return;
          }
          current = data.thread;
          messages = data.messages || [];
          setStatus("");
          paint();
        });
      }

      function startThread(agentId) {
        setStatus("正在开对话…");
        return api("/api/agents/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ agentId: agentId })
        }).then(function (data) {
          if (dead) {
            return;
          }
          current = data.thread;
          messages = data.messages || [];
          setStatus("");
          return loadList();
        });
      }

      function openAgent(agentId) {
        const existing = threads.find(function (thread) {
          return thread.agentId === agentId;
        });
        if (existing) {
          return openThread(existing.id);
        }
        return startThread(agentId);
      }

      catalogEl.addEventListener("click", function (event) {
        const button = event.target.closest("[data-agent]");
        if (!button) {
          return;
        }
        openAgent(button.getAttribute("data-agent")).catch(function (err) {
          if (!dead) {
            setStatus(err.message || "无法打开", true);
          }
        });
      });

      threadsEl.addEventListener("click", function (event) {
        const button = event.target.closest("[data-thread]");
        if (!button) {
          return;
        }
        openThread(button.getAttribute("data-thread")).catch(function (err) {
          if (!dead) {
            setStatus(err.message || "无法打开", true);
          }
        });
      });

      newEl.addEventListener("click", function () {
        if (!current) {
          return;
        }
        startThread(current.agentId).catch(function (err) {
          if (!dead) {
            setStatus(err.message || "无法开对话", true);
          }
        });
      });

      formEl.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!current) {
          return;
        }
        const text = textEl.value.trim();
        if (!text) {
          setStatus("请输入内容", true);
          return;
        }
        sendEl.disabled = true;
        setStatus("正在发送…");
        api("/api/agents/threads/" + current.id + "/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ text: text })
        })
          .then(function (data) {
            if (dead) {
              return;
            }
            textEl.value = "";
            current = data.thread;
            messages = messages.concat([data.message, data.reply]);
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
              sendEl.disabled = !current;
              textEl.focus();
            }
          });
      });

      textEl.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          formEl.requestSubmit();
        }
      });

      loadList().catch(function (err) {
        if (!dead) {
          setStatus(err.message || "无法加载工作台", true);
        }
      });

      return function unmount() {
        dead = true;
        root.innerHTML = "";
      };
    }
  };
})();
