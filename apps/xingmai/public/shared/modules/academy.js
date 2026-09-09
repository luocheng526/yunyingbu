/* xm-module-academy 0.1.128 */
(function () {
  const ASSET_VER = "0.1.128";
  const CSS_HREF = "/academy.css?v=" + ASSET_VER;
  const CATALOG_HREF = "/academy-catalog.json?v=" + ASSET_VER;

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

  function loadLocalProgress() {
    try {
      const rows = JSON.parse(localStorage.getItem("xm-academy-progress") || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      return [];
    }
  }

  function saveLocalProgress(rows) {
    try {
      localStorage.setItem("xm-academy-progress", JSON.stringify(rows));
    } catch (err) {
      /* ignore quota */
    }
  }

  function api(path, options) {
    return fetch(path, {
      credentials: "same-origin",
      headers: Object.assign({ Accept: "application/json" }, options && options.headers),
      method: (options && options.method) || "GET",
      body: options && options.body
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

  function paragraphs(body) {
    return String(body || "")
      .split(/\n{2,}/)
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/academy"] = {
    mount: function (root) {
      ensureCss();
      root.innerHTML =
        '<main class="page academy-page">' +
        '<header class="page-head"><p class="kicker">运营培训知识库</p><h1>甄选商学院</h1>' +
        '<p class="lead">课件先结构化：标题、分类、正文、是否发布。智能体只检索已发布篇，草稿箱里的未整理记录不进检索。</p></header>' +
        '<section class="kpi-grid" id="academy-stats" aria-label="课件规模"></section>' +
        '<div class="academy-toolbar"><input class="academy-search" id="academy-q" type="search" placeholder="按标题、分类、正文检索（等同智能体）" />' +
        '<div class="academy-chips" id="academy-chips"></div></div>' +
        '<div class="academy-layout">' +
        '<section class="panel"><h2>已发布课件</h2><div class="academy-course-list" id="academy-docs"></div></section>' +
        '<section class="panel" id="academy-reader"><h2>正文</h2><p class="academy-empty">点左侧一篇开始读。每篇都有标题 / 分类 / 正文 / 是否发布。</p></section>' +
        "</div></main>";

      const statsEl = root.querySelector("#academy-stats");
      const chipsEl = root.querySelector("#academy-chips");
      const listEl = root.querySelector("#academy-docs");
      const readerEl = root.querySelector("#academy-reader");
      const searchEl = root.querySelector("#academy-q");
      let dead = false;
      let categories = [];
      let allDocs = [];
      let progress = [];
      let categoryFilter = "";
      let showDrafts = false;
      let hitsFromSearch = null;
      let activeId = "";

      function doneSet() {
        const set = new Set();
        progress.forEach(function (row) {
          if (row.done) {
            set.add(row.docId || row.lessonId);
          }
        });
        return set;
      }

      function publishedDocs() {
        return allDocs.filter(function (doc) {
          return doc.published;
        });
      }

      function renderStats() {
        const pub = publishedDocs().length;
        const drafts = allDocs.length - pub;
        const done = doneSet().size;
        statsEl.innerHTML =
          '<article class="kpi-card"><div class="label">分类</div><div class="value">' +
          escapeHtml(categories.length) +
          '<span class="unit">个</span></div></article>' +
          '<article class="kpi-card"><div class="label">已发布</div><div class="value">' +
          escapeHtml(pub) +
          '<span class="unit">篇</span></div></article>' +
          '<article class="kpi-card"><div class="label">草稿</div><div class="value">' +
          escapeHtml(drafts) +
          '<span class="unit">篇</span></div></article>' +
          '<article class="kpi-card"><div class="label">已学完</div><div class="value">' +
          escapeHtml(done) +
          '<span class="unit">篇</span></div></article>';
      }

      function renderChips() {
        chipsEl.innerHTML =
          '<button type="button" class="academy-chip' +
          (!categoryFilter && !showDrafts ? " is-on" : "") +
          '" data-cat="">已发布</button>' +
          categories
            .map(function (cat) {
              return (
                '<button type="button" class="academy-chip' +
                (categoryFilter === cat.id ? " is-on" : "") +
                '" data-cat="' +
                escapeHtml(cat.id) +
                '">' +
                escapeHtml(cat.name) +
                "</button>"
              );
            })
            .join("") +
          '<button type="button" class="academy-chip' +
          (showDrafts ? " is-on" : "") +
          '" data-draft="1">草稿（不检索）</button>';
      }

      function visibleDocs() {
        if (hitsFromSearch) {
          return hitsFromSearch;
        }
        return allDocs.filter(function (doc) {
          if (showDrafts) {
            return !doc.published;
          }
          if (!doc.published) {
            return false;
          }
          if (categoryFilter && doc.categoryId !== categoryFilter) {
            return false;
          }
          return true;
        });
      }

      function renderList() {
        const rows = visibleDocs();
        if (!rows.length) {
          listEl.innerHTML = '<p class="academy-empty">没有可展示的结构化课件。</p>';
          return;
        }
        listEl.innerHTML = rows
          .map(function (doc) {
            return (
              '<button type="button" class="academy-course' +
              (activeId === doc.id ? " is-on" : "") +
              '" data-id="' +
              escapeHtml(doc.id) +
              '"><h3>' +
              (doneSet().has(doc.id) ? "✓ " : "") +
              escapeHtml(doc.title) +
              '</h3><p class="academy-meta"><span class="academy-field">分类</span> ' +
              escapeHtml(doc.category) +
              ' · <span class="academy-badge' +
              (doc.published ? " is-pub" : " is-draft") +
              '">' +
              (doc.published ? "已发布" : "未发布") +
              "</span></p><p>" +
              escapeHtml(String(doc.body || "").slice(0, 72)) +
              (String(doc.body || "").length > 72 ? "…" : "") +
              "</p></button>"
            );
          })
          .join("");
      }

      function renderReader() {
        const doc = allDocs.find(function (item) {
          return item.id === activeId;
        });
        if (!doc) {
          readerEl.innerHTML =
            "<h2>正文</h2><p class=\"academy-empty\">点左侧一篇开始读。每篇都有标题 / 分类 / 正文 / 是否发布。</p>";
          return;
        }
        const learned = doneSet().has(doc.id);
        readerEl.innerHTML =
          "<h2>" +
          escapeHtml(doc.title) +
          '</h2><dl class="academy-fields"><div><dt>标题</dt><dd>' +
          escapeHtml(doc.title) +
          "</dd></div><div><dt>分类</dt><dd>" +
          escapeHtml(doc.category) +
          "</dd></div><div><dt>是否发布</dt><dd>" +
          (doc.published ? "已发布（智能体可检索）" : "未发布（不进检索）") +
          "</dd></div></dl><div class=\"academy-lesson-body\"><p class=\"academy-meta\">正文</p>" +
          paragraphs(doc.body)
            .map(function (para) {
              return "<p>" + escapeHtml(para) + "</p>";
            })
            .join("") +
          '</div><div class="academy-actions">' +
          (doc.published
            ? '<button type="button" id="academy-done">' + (learned ? "标为未学" : "学完本篇") + "</button>"
            : "") +
          "</div>" +
          '<p class="academy-status">' +
          (doc.published
            ? learned
              ? "本篇已记入学习进度。"
              : "已发布，可供 /api/academy/search 检索。"
            : "草稿不进入智能体检索。整理成四字段并改为已发布后再入库。") +
          "</p>";
      }

      function openDoc(id) {
        activeId = id;
        const local = allDocs.find(function (item) {
          return item.id === id;
        });
        const q = local && !local.published ? "?draft=1" : "";
        api("/api/academy/docs/" + encodeURIComponent(id) + q)
          .then(function (data) {
            if (dead) {
              return;
            }
            allDocs = allDocs.map(function (item) {
              return item.id === data.doc.id ? Object.assign({}, item, data.doc) : item;
            });
            renderList();
            renderReader();
          })
          .catch(function () {
            if (dead) {
              return;
            }
            renderList();
            renderReader();
          });
      }

      function runSearch() {
        const q = String(searchEl.value || "").trim();
        if (!q || showDrafts) {
          hitsFromSearch = null;
          renderList();
          return;
        }
        api("/api/academy/search?q=" + encodeURIComponent(q))
          .then(function (data) {
            if (dead) {
              return;
            }
            hitsFromSearch = data.hits || [];
            renderList();
          })
          .catch(function () {
            const needle = q;
            hitsFromSearch = publishedDocs().filter(function (doc) {
              return (doc.title + doc.category + (doc.body || "")).indexOf(needle) !== -1;
            });
            renderList();
          });
      }

      chipsEl.addEventListener("click", function (ev) {
        const draftBtn = ev.target.closest("[data-draft]");
        const catBtn = ev.target.closest("[data-cat]");
        if (draftBtn) {
          showDrafts = true;
          categoryFilter = "";
          hitsFromSearch = null;
          renderChips();
          renderList();
          return;
        }
        if (!catBtn) {
          return;
        }
        showDrafts = false;
        categoryFilter = catBtn.getAttribute("data-cat") || "";
        runSearch();
        renderChips();
      });
      listEl.addEventListener("click", function (ev) {
        const btn = ev.target.closest("[data-id]");
        if (!btn) {
          return;
        }
        openDoc(btn.getAttribute("data-id"));
      });
      readerEl.addEventListener("click", function (ev) {
        if (ev.target.id !== "academy-done" || !activeId) {
          return;
        }
        const learned = doneSet().has(activeId);
        const payload = { docId: activeId, done: !learned };
        api("/api/academy/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload)
        })
          .then(function (data) {
            return data.progress;
          })
          .catch(function () {
            return payload;
          })
          .then(function (row) {
            if (dead) {
              return;
            }
            progress = progress.filter(function (item) {
              return (item.docId || item.lessonId) !== activeId;
            });
            if (row && row.done) {
              progress.push(row);
            }
            saveLocalProgress(progress);
            renderStats();
            renderList();
            renderReader();
          });
      });
      searchEl.addEventListener("input", function () {
        runSearch();
      });

      Promise.all([
        fetch(CATALOG_HREF, { credentials: "same-origin", headers: { Accept: "application/json" } })
          .then(function (res) {
            if (!res.ok) {
              throw new Error("目录 " + res.status);
            }
            return res.json();
          })
          .catch(function () {
            return { categories: [], docs: [] };
          }),
        api("/api/academy").catch(function () {
          return {};
        }),
        api("/api/academy/docs?published=all&body=1").catch(function () {
          return { docs: [] };
        }),
        api("/api/academy/progress").catch(function () {
          return { progress: loadLocalProgress() };
        })
      ]).then(function (quad) {
        if (dead) {
          return;
        }
        const file = quad[0] || {};
        categories = (file.categories || quad[1].categories || []).filter(function (item) {
          return item.id !== "draft";
        });
        const fromApi = quad[2].docs && quad[2].docs.length ? quad[2].docs : null;
        allDocs = fromApi || file.docs || [];
        progress = Array.isArray(quad[3].progress) ? quad[3].progress : loadLocalProgress();
        renderStats();
        renderChips();
        renderList();
      });

      return function unmount() {
        dead = true;
        root.innerHTML = "";
      };
    }
  };
})();
