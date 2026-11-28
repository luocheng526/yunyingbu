(function () {
  if (window.XmChartMotion || !Element.prototype.animate || !window.IntersectionObserver) return;

  const pace = { line: 1250, ring: 1350, bar: 1100, stagger: 35, maxStagger: 210 };
  const curve = "cubic-bezier(.32,.08,.55,1)";
  const chartTypes = [
    ["line", "svg.xm-hm-line, svg.xm-hm-sales-svg, svg.xm-hl-spark, svg.ch-spark, svg.org-hero-spark, svg[aria-label='本模块任务与工时趋势']", "path[d], polyline[points], polygon[points], circle"],
    ["line", ".wc-trend-graph > svg", ".wc-overview-chart-area, .wc-overview-chart-line"],
    ["line", ".hr-chart-plot > svg, svg.hr-line", "polygon[points], polyline[points]"],
    ["line", ".bd-block > svg[viewBox='0 0 800 220'], .bd-operating-trend > svg", "path[stroke-width], circle"],
    ["line", "canvas.competition-chart"],
    ["column", ".wc-trend-graph > svg", ".wc-dash-bar[height]:not([height='0'])"],
    ["bar", ".fb-category-list", ".fb-bar > i"],
    ["bar", ".bd-bars", ".bd-bar > i"],
    ["bar", ".hr-dashboard-ranks", ".hr-rank-track > i"],
    ["bar", ".wc-rank-bar, .hr-dashboard-meter", "i"],
    ["stackedBar", ".hr-demographic-bar"],
    ["ring", ".wc-donut"],
    ["svgRing", "svg.hr-donut", "circle[stroke-dasharray]"],
    ["svgRing", "svg.org-donut", "path[d]"]
  ];
  const pageControls = [
    ["button[data-view].is-on", "view"],
    ["[data-action='tab'][aria-current='page']", "id"],
    [".hr-tab[aria-selected='true']", "tab"],
    [".org-tab.is-active[data-pane]", "pane"],
    [".stores-tabs [data-page][aria-current='page']", "page"],
    ["[data-c-tab][aria-current='page']", "cTab"],
    ["[data-act='page'].is-on[data-page]", "page"],
    ["[data-act='tab'].is-on[data-tab]", "tab"],
    ["[data-act='shop-view'].is-on[data-view]", "view"],
    ["[data-act='view'].is-on[data-view]", "view"]
  ];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function sweepFrames(start, box = "view-box") {
    const edge = ["50% -5%", "105% -5%", "105% 50%", "105% 105%", "50% 105%", "-5% 105%", "-5% 50%", "-5% -5%"];
    const perimeter = Array.from({ length: 9 }, (_, index) => edge[(index + start) % edge.length]);
    return perimeter.map((_, step) => ({
      clipPath: "polygon(50% 50%, " + perimeter.map((point, index) => index <= step ? point : perimeter[step]).join(", ") + ") " + box
    }));
  }
  const topSweep = sweepFrames(0);
  // Human resources circles are rotated -90° by the renderer, so use their unrotated start.
  const rotatedSweep = sweepFrames(2);
  const workRingSweep = sweepFrames(0, "border-box");

  function lineFrames(plot, marks) {
    const view = plot.viewBox?.baseVal;
    if (!view?.width) return [
      { clipPath: "inset(0 100% 0 0)" },
      { clipPath: "inset(0)" }
    ];
    let left = Infinity;
    let right = -Infinity;
    for (const mark of marks) {
      const box = mark.getBBox();
      if (box.width || box.height) {
        left = Math.min(left, box.x);
        right = Math.max(right, box.x + box.width);
      }
    }
    if (!Number.isFinite(left)) return null;
    const margin = Math.max(view.width * 0.012, 1);
    const start = (left - margin - view.x) / view.width * 100;
    const end = (right + margin - view.x) / view.width * 100;
    return [start, end].map(x => ({ clipPath: "inset(-100% " + (100 - x) + "% -100% -100%) view-box" }));
  }

  function animate(playback, mark, frames, duration, elapsed, delay = 0, easing = curve) {
    if (elapsed >= duration + delay) return;
    const animation = mark.animate(frames, { duration, delay, easing, fill: "backwards" });
    animation.currentTime = elapsed;
    playback.effects.add(animation);
    animation.onfinish = () => playback.effects.delete(animation);
    return animation;
  }

  function playWorkRing(playback, plot, elapsed) {
    const colors = plot.style.backgroundImage;
    if (!colors || elapsed >= pace.ring) return;

    // Keep the track and center visible while a separate color layer is clipped.
    const layer = document.createElement("span");
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText = "position:absolute;inset:0;border-radius:inherit;pointer-events:none;" +
      "mask-image:radial-gradient(circle closest-side,transparent 65%,#000 66%)";
    layer.style.backgroundImage = colors;
    plot.prepend(layer);

    const track = { backgroundImage: "none", backgroundColor: "var(--wc-line,#e2eaf4)" };
    animate(playback, plot, [track, track], pace.ring, elapsed);
    const sweep = animate(playback, layer, workRingSweep, pace.ring, elapsed, 0, "linear");
    const removeLayer = () => layer.remove();
    sweep.addEventListener("finish", removeLayer, { once: true });
    sweep.addEventListener("cancel", removeLayer, { once: true });
  }

  function play(group, now, previous) {
    const elapsed = previous ? now - previous.startedAt : 0;
    const playback = { ...group, startedAt: previous?.startedAt ?? now, effects: new Set() };
    const { type, plot, marks } = group;
    const line = type === "line" ? lineFrames(plot, marks) : null;
    if (type === "line" && !line) return;
    stop(previous);
    played.set(group.key, playback);
    if (type === "ring") {
      playWorkRing(playback, plot, elapsed);
      return;
    }
    for (const [index, mark] of marks.entries()) {
      if (type === "line") {
        animate(playback, mark, line, pace.line, elapsed, 0, "linear");
      } else if (type === "svgRing") {
        animate(playback, mark, plot.matches(".hr-donut") ? rotatedSweep : topSweep, pace.ring, elapsed, 0, "linear");
      } else {
        const column = type === "column";
        const from = column ? "inset(100% -2px -2px) fill-box" : "inset(0 100% 0 0)";
        const to = column ? "inset(-2px) fill-box" : "inset(0)";
        const delay = Math.min(pace.maxStagger, (column ? Math.floor(index / 2) : index) * pace.stagger);
        animate(playback, mark, [{ clipPath: from }, { clipPath: to }], pace.bar, elapsed, delay);
      }
    }
  }

  function stop(playback) {
    if (!playback) return;
    for (const animation of playback.effects) animation.cancel();
    playback.effects.clear();
  }

  let root = null;
  let subpage = "";
  let trendMode = "";
  let frame = 0;
  const played = new Map();
  const pending = new Map();

  function resetPlayback() {
    visibility.disconnect();
    pending.clear();
    for (const playback of played.values()) stop(playback);
    played.clear();
  }

  function isVisible(plot) {
    const box = plot.getBoundingClientRect();
    const visibleHeight = Math.min(window.innerHeight, box.bottom) - Math.max(0, box.top);
    return box.width > 0 && box.height > 0 && box.right > 0 && box.left < window.innerWidth &&
      visibleHeight >= Math.min(36, box.height * 0.2) && getComputedStyle(plot).visibility !== "hidden";
  }

  function sameMarks(previous, marks) {
    return previous?.marks.length === marks.length && previous.marks.every((mark, index) => mark === marks[index]);
  }

  function show(batch, now) {
    for (const group of batch) {
      const earlier = played.get(group.key);
      if (sameMarks(earlier, group.marks)) continue;
      play(group, now, earlier);
    }
  }

  const visibility = new IntersectionObserver(entries => {
    const now = performance.now();
    for (const entry of entries) {
      const plot = entry.target;
      const batch = pending.get(plot);
      if (!batch || !root?.contains(plot) || !entry.isIntersecting ||
          !entry.intersectionRect.width || !entry.intersectionRect.height || !isVisible(plot)) continue;
      pending.delete(plot);
      visibility.unobserve(plot);
      show(batch, now);
    }
  }, { threshold: [0, 0.01, 0.2] });

  function scan() {
    frame = 0;
    if (!root || reducedMotion.matches) return;
    const selection = pageControls.map(([selector, attr]) => root.querySelector(selector)?.dataset[attr] || "").join("|");
    if (selection !== subpage) {
      subpage = selection;
      resetPlayback();
    }
    const mode = root.querySelector("[data-action='chartMode'][aria-pressed='true']")?.dataset.mode || "";
    if (mode && trendMode && mode !== trendMode) {
      for (const [key, item] of played) {
        if (!item.plot.matches(".wc-trend-graph > svg")) continue;
        stop(item);
        played.delete(key);
      }
    }
    trendMode = mode;
    const now = performance.now();
    const next = new Map();
    chartTypes.forEach(([type, selector, target], chartIndex) => {
      const slots = new Map();
      root.querySelectorAll(selector).forEach(plot => {
        const identity = plot.closest("[data-chart], [id]") || plot;
        const label = identity.id || identity.getAttribute("data-chart") || "";
        const slot = slots.get(label) || 0;
        slots.set(label, slot + 1);
        const key = chartIndex + ":" + label + ":" + slot;
        let marks = target ? Array.from(plot.querySelectorAll(target)) : [plot];
        if (type === "bar") marks = marks.filter(mark => parseFloat(mark.style.width) > 0);
        if (marks.length === 0) return;
        const earlier = played.get(key);
        if (sameMarks(earlier, marks)) return;
        if (!next.has(plot)) next.set(plot, []);
        next.get(plot).push({ key, type, plot, marks });
      });
    });
    for (const plot of pending.keys()) {
      if (next.has(plot)) continue;
      visibility.unobserve(plot);
      pending.delete(plot);
    }
    for (const [plot, batch] of next) {
      if (isVisible(plot)) {
        visibility.unobserve(plot);
        pending.delete(plot);
        show(batch, now);
      } else {
        if (!pending.has(plot)) visibility.observe(plot);
        pending.set(plot, batch);
      }
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(scan);
  }

  const updates = new MutationObserver(records => {
    if (records.some(record => {
      const attr = record.attributeName;
      if (attr === "class") return record.target.matches("[data-view], [data-act='page'], [data-act='tab'], .org-tab");
      if (attr === "style") return record.target.matches(".wc-donut, .fb-bar > i, .bd-bar > i, .hr-rank-track > i, .wc-rank-bar > i, .hr-dashboard-meter > i");
      if (attr === "aria-pressed") return record.target.matches("[data-action='chartMode']");
      return true;
    })) schedule();
  });

  function activate(nextRoot, replay = false) {
    if (root === nextRoot && !replay) return;
    updates.disconnect();
    resetPlayback();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    subpage = "";
    trendMode = "";
    root = nextRoot;
    if (!root || reducedMotion.matches) return;
    updates.observe(root, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["class", "aria-current", "aria-selected", "aria-pressed", "hidden", "style", "d", "points", "height"]
    });
    schedule();
  }

  window.XmChartMotion = { activate };
  activate(document.getElementById("xm-content"));
  reducedMotion.addEventListener("change", () => activate(root, true));
  window.addEventListener("pageshow", event => {
    if (event.persisted) activate(root, true);
  });
})();
