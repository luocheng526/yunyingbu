/* xm-module-academy 0.1.126 */
(function () {
  const ASSET_VER = "0.1.126";
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

  window.XmModules = window.XmModules || {};
  window.XmModules["/academy"] = {
    mount: function (root) {
      ensureCss();
      root.innerHTML =
        '<main class="page academy-page">' +
        '<header class="page-head"><p class="kicker">运营培训知识库</p><h1>甄选商学院</h1>' +
        '<p class="lead">给运营部用的入职和日常课。内容挂在本页内容区，不改侧栏。沈/韩的「培训系统」子菜单不是这里。</p></header>' +
        '<section class="kpi-grid" id="academy-stats" aria-label="课程规模"></section>' +
        '<div class="academy-toolbar"><input class="academy-search" id="academy-q" type="search" placeholder="搜索课程" />' +
        '<div class="academy-chips" id="academy-chips"></div></div>' +
        '<div class="academy-layout">' +
        '<section class="panel"><h2>课程目录</h2><div class="academy-course-list" id="academy-courses"></div></section>' +
        '<section class="panel" id="academy-reader"><h2>课时</h2><p class="academy-empty">点左侧一门课开始读。</p></section>' +
        "</div></main>";

      const statsEl = root.querySelector("#academy-stats");
      const chipsEl = root.querySelector("#academy-chips");
      const listEl = root.querySelector("#academy-courses");
      const readerEl = root.querySelector("#academy-reader");
      const searchEl = root.querySelector("#academy-q");
      let dead = false;
      let tracks = [];
      let courses = [];
      let progress = [];
      let trackFilter = "";
      let activeCourse = null;
      let activeLessonId = "";
      let localCatalog = { tracks: [], courses: [] };

      function summaries(list) {
        return (list || []).map(function (course) {
          return {
            id: course.id,
            track: course.track,
            title: course.title,
            minutes: course.minutes,
            summary: course.summary,
            lessonCount: course.lessons ? course.lessons.length : Number(course.lessonCount || 0),
            lessons: course.lessons
          };
        });
      }

      function doneSet() {
        const set = new Set();
        progress.forEach(function (row) {
          if (row.done) {
            set.add(row.lessonId);
          }
        });
        return set;
      }

      function renderStats(stats) {
        const s = stats || {
          tracks: tracks.length,
          courses: courses.length,
          lessons: courses.reduce(function (sum, course) {
            return sum + Number(course.lessonCount || 0);
          }, 0),
          minutes: courses.reduce(function (sum, course) {
            return sum + Number(course.minutes || 0);
          }, 0)
        };
        const done = doneSet().size;
        statsEl.innerHTML =
          '<article class="kpi-card"><div class="label">方向</div><div class="value">' +
          escapeHtml(s.tracks) +
          '<span class="unit">条</span></div></article>' +
          '<article class="kpi-card"><div class="label">课程</div><div class="value">' +
          escapeHtml(s.courses) +
          '<span class="unit">门</span></div></article>' +
          '<article class="kpi-card"><div class="label">课时</div><div class="value">' +
          escapeHtml(s.lessons) +
          '<span class="unit">节</span></div></article>' +
          '<article class="kpi-card"><div class="label">已学完</div><div class="value">' +
          escapeHtml(done) +
          '<span class="unit">节</span></div></article>';
      }

      function renderChips() {
        chipsEl.innerHTML =
          '<button type="button" class="academy-chip' +
          (trackFilter ? "" : " is-on") +
          '" data-track="">全部</button>' +
          tracks
            .map(function (track) {
              return (
                '<button type="button" class="academy-chip' +
                (trackFilter === track.id ? " is-on" : "") +
                '" data-track="' +
                escapeHtml(track.id) +
                '">' +
                escapeHtml(track.name) +
                "</button>"
              );
            })
            .join("");
      }

      function filteredCourses() {
        const q = String(searchEl.value || "").trim();
        return courses.filter(function (course) {
          if (trackFilter && course.track !== trackFilter) {
            return false;
          }
          if (!q) {
            return true;
          }
          return (course.title + course.summary).indexOf(q) !== -1;
        });
      }

      function trackName(id) {
        const hit = tracks.find(function (track) {
          return track.id === id;
        });
        return hit ? hit.name : id;
      }

      function renderCourses() {
        const rows = filteredCourses();
        if (!rows.length) {
          listEl.innerHTML = '<p class="academy-empty">没有匹配的课程。</p>';
          return;
        }
        listEl.innerHTML = rows
          .map(function (course) {
            const finished = course.lessons
              ? course.lessons.filter(function (lesson) {
                  return doneSet().has(lesson.id);
                }).length
              : 0;
            return (
              '<button type="button" class="academy-course' +
              (activeCourse && activeCourse.id === course.id ? " is-on" : "") +
              '" data-id="' +
              escapeHtml(course.id) +
              '"><h3>' +
              escapeHtml(course.title) +
              "</h3><p class=\"academy-meta\">" +
              escapeHtml(trackName(course.track)) +
              " · " +
              escapeHtml(course.minutes) +
              " 分钟 · " +
              escapeHtml(course.lessonCount || (course.lessons && course.lessons.length) || 0) +
              " 节" +
              (course.lessons ? " · 已学 " + finished : "") +
              "</p><p>" +
              escapeHtml(course.summary) +
              "</p></button>"
            );
          })
          .join("");
      }

      function renderReader() {
        if (!activeCourse) {
          readerEl.innerHTML = "<h2>课时</h2><p class=\"academy-empty\">点左侧一门课开始读。</p>";
          return;
        }
        const lessons = activeCourse.lessons || [];
        const lesson =
          lessons.find(function (item) {
            return item.id === activeLessonId;
          }) || lessons[0];
        if (!lesson) {
          readerEl.innerHTML =
            "<h2>" + escapeHtml(activeCourse.title) + "</h2><p class=\"academy-empty\">这门课还没有课时。</p>";
          return;
        }
        activeLessonId = lesson.id;
        const learned = doneSet().has(lesson.id);
        readerEl.innerHTML =
          "<h2>" +
          escapeHtml(activeCourse.title) +
          "</h2><p class=\"academy-meta\">" +
          escapeHtml(lesson.title) +
          " · " +
          escapeHtml(lesson.minutes) +
          " 分钟</p><ul class=\"academy-lessons\">" +
          lessons
            .map(function (item) {
              return (
                "<li><button type=\"button\" class=\"" +
                (item.id === lesson.id ? "is-on" : "") +
                "\" data-lesson=\"" +
                escapeHtml(item.id) +
                "\">" +
                (doneSet().has(item.id) ? "✓ " : "") +
                escapeHtml(item.title) +
                "</button></li>"
              );
            })
            .join("") +
          '</ul><div class="academy-lesson-body">' +
          (lesson.body || [])
            .map(function (para) {
              return "<p>" + escapeHtml(para) + "</p>";
            })
            .join("") +
          '</div><div class="academy-actions"><button type="button" id="academy-done">' +
          (learned ? "标为未学" : "学完本节") +
          '</button><button type="button" class="ghost" id="academy-next">下一节</button></div>' +
          '<p class="academy-status" id="academy-msg">' +
          (learned ? "本节已记入学习进度。" : "") +
          "</p>";
      }

      function openCourse(id) {
        const local = (localCatalog.courses || []).find(function (item) {
          return item.id === id;
        });
        api("/api/academy/courses/" + encodeURIComponent(id))
          .then(function (data) {
            if (dead) {
              return;
            }
            activeCourse = data.course;
            activeLessonId = activeCourse.lessons && activeCourse.lessons[0] ? activeCourse.lessons[0].id : "";
            renderCourses();
            renderReader();
          })
          .catch(function (err) {
            if (dead) {
              return;
            }
            if (local && local.lessons) {
              activeCourse = local;
              activeLessonId = local.lessons[0] ? local.lessons[0].id : "";
              renderCourses();
              renderReader();
              return;
            }
            readerEl.innerHTML =
              "<h2>课时</h2><p class=\"academy-status error\">无法打开课程：" +
              escapeHtml(err.message) +
              "</p>";
          });
      }

      chipsEl.addEventListener("click", function (ev) {
        const btn = ev.target.closest("[data-track]");
        if (!btn) {
          return;
        }
        trackFilter = btn.getAttribute("data-track") || "";
        renderChips();
        renderCourses();
      });
      listEl.addEventListener("click", function (ev) {
        const btn = ev.target.closest("[data-id]");
        if (!btn) {
          return;
        }
        openCourse(btn.getAttribute("data-id"));
      });
      readerEl.addEventListener("click", function (ev) {
        const lessonBtn = ev.target.closest("[data-lesson]");
        if (lessonBtn && activeCourse) {
          activeLessonId = lessonBtn.getAttribute("data-lesson");
          renderReader();
          return;
        }
        if (ev.target.id === "academy-next" && activeCourse && activeCourse.lessons) {
          const ids = activeCourse.lessons.map(function (item) {
            return item.id;
          });
          const index = ids.indexOf(activeLessonId);
          const next = activeCourse.lessons[index + 1] || activeCourse.lessons[0];
          activeLessonId = next.id;
          renderReader();
          return;
        }
        if (ev.target.id === "academy-done" && activeCourse) {
          const learned = doneSet().has(activeLessonId);
          const msg = root.querySelector("#academy-msg");
          const payload = {
            courseId: activeCourse.id,
            lessonId: activeLessonId,
            done: !learned
          };
          api("/api/academy/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload)
          })
            .then(function (data) {
              return data.progress;
            })
            .catch(function () {
              return {
                courseId: payload.courseId,
                lessonId: payload.lessonId,
                done: payload.done
              };
            })
            .then(function (row) {
              if (dead) {
                return;
              }
              progress = progress.filter(function (item) {
                return item.lessonId !== activeLessonId;
              });
              if (row && row.done) {
                progress.push(row);
              }
              saveLocalProgress(progress);
              renderStats();
              renderCourses();
              renderReader();
            });
        }
      });
      searchEl.addEventListener("input", function () {
        renderCourses();
      });

      renderStats();
      renderChips();
      renderCourses();

      Promise.all([
        fetch(CATALOG_HREF, { credentials: "same-origin", headers: { Accept: "application/json" } })
          .then(function (res) {
            if (!res.ok) {
              throw new Error("目录 " + res.status);
            }
            return res.json();
          })
          .catch(function () {
            return { tracks: [], courses: [] };
          }),
        api("/api/academy").catch(function () {
          return {};
        }),
        api("/api/academy/progress").catch(function () {
          return { progress: loadLocalProgress() };
        })
      ]).then(function (triple) {
        if (dead) {
          return;
        }
        localCatalog = triple[0] || { tracks: [], courses: [] };
        tracks = (localCatalog.tracks && localCatalog.tracks.length
          ? localCatalog.tracks
          : triple[1].tracks) || [];
        courses = summaries(
          localCatalog.courses && localCatalog.courses.length ? localCatalog.courses : triple[1].courses
        );
        progress = Array.isArray(triple[2].progress) ? triple[2].progress : loadLocalProgress();
        renderStats(triple[1].stats);
        renderChips();
        renderCourses();
      });

      return function unmount() {
        dead = true;
        root.innerHTML = "";
      };
    }
  };
})();
