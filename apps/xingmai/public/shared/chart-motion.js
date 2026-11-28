(function () {
  if (window.XmChartMotion || !Element.prototype.animate || !window.IntersectionObserver) return;

  // Existing chart graphics, kept separate from their axes, labels and controls.
  const charts = [
    ["line", "svg.xm-hm-line, svg.xm-hm-sales-svg, svg.xm-hl-spark, svg.ch-spark, svg[aria-label='本模块任务与工时趋势']", "path[d], polyline[points], polygon[points], circle"],
    ["line", ".wc-trend-graph > svg", ".wc-overview-chart-area, .wc-overview-chart-line"],
    ["line", ".hr-chart-plot > svg", "polygon[points], polyline[points]"],
    ["line", ".bd-block > svg[viewBox='0 0 800 220'], .bd-operating-trend > svg", "path[stroke-width], circle"],
    ["canvas", "canvas.competition-chart"],
    ["columns", ".wc-trend-graph > svg", ".wc-dash-bar[height]:not([height='0'])"],
    ["bars", ".fb-category-list", ".fb-bar > i"],
    ["bars", ".bd-bars", ".bd-bar > i"],
    ["bars", ".wc-rank-bar, .hr-dashboard-meter", "i"],
    ["stackedBar", ".hr-demographic-bar"],
    ["ring", ".wc-donut"],
    ["svgRing", "svg.hr-donut", "circle[stroke-dasharray]"]
  ];
  const pageControls = [
    ["button[data-view].is-on", "view"],
    ["[data-action='tab'][aria-current='page']", "id"],
    [".hr-tab[aria-selected='true']", "tab"],
    [".stores-tabs [data-page][aria-current='page']", "page"],
    ["[data-act='page'].is-on[data-page]", "page"],
    ["[data-act='tab'].is-on[data-tab]", "tab"],
    ["[data-act='shop-view'].is-on[data-view], [data-act='view'].is-on[data-view]", "view"]
  ];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const easing = "cubic-bezier(.22,.72,.22,1)";
  const angle = "--xm-chart-reveal-angle";
  const canSweep = typeof window.CSS?.registerProperty === "function";

  if (canSweep) {
    CSS.registerProperty({ name: angle, syntax: "<angle>", inherits: false, initialValue: "360deg" });
  }

  function animate(mark, frames, duration, delay = 0, curve = easing) {
    const animation = mark.animate(frames, { duration, delay, easing: curve, fill: "backwards" });
    animations.add(animation);
    animation.onfinish = () => animations.delete(animation);
  }

  function clip(mark, from, to, duration, delay) {
    animate(mark, [{ clipPath: from }, { clipPath: to }], duration, delay);
  }

  function play(type, marks) {
    if (type === "svgRing") {
      for (const mark of marks) {
        const [dash, gap] = mark.getAttribute("stroke-dasharray").split(/[\s,]+/).map(Number);
        const length = dash + gap;
        if (!(dash > 0 && length > 0)) continue;
        const start = Math.abs(Number(mark.getAttribute("stroke-dashoffset"))) || 0;
        animate(mark, [{ strokeDasharray: `0px ${length}px` }, { strokeDasharray: `${dash}px ${gap}px` }],
          880 * dash / length, 65 + 880 * start / length, "linear");
      }
      return;
    }
    for (const [index, mark] of marks.entries()) {
      if (type === "ring") {
        if (canSweep) {
          // The inner disk and its label stay visible while the colored arcs sweep in.
          const maskImage = `radial-gradient(circle closest-side, #000 65%, transparent 66%), conic-gradient(#000 var(${angle}), transparent 0deg)`;
          animate(mark, [{ maskImage, [angle]: "0deg" }, { maskImage, [angle]: "360deg" }], 900, 65);
        } else {
          animate(mark, [{ opacity: 0.3 }, { opacity: 1 }], 450);
        }
      } else if (type === "columns") {
        clip(mark, "inset(100% -2px -2px) fill-box", "inset(-2px) fill-box", 580, Math.min(8, Math.floor(index / 2)) * 30);
      } else if (type === "bars" || type === "stackedBar") {
        clip(mark, "inset(0 100% 0 0)", "inset(0)", 580, Math.min(index, 8) * 30);
      } else {
        const box = type === "canvas" ? "border-box" : "view-box";
        clip(mark, `inset(-100% 100% -100% 0%) ${box}`, `inset(-100% 0% -100% 0%) ${box}`, 760);
      }
    }
  }

  let root = null;
  let subpage = "";
  let frame = 0;
  const played = new Set();
  const pending = new Map();
  const animations = new Set();

  function resetPlayback() {
    visibility.disconnect();
    pending.clear();
    played.clear();
    for (const animation of animations) animation.cancel();
    animations.clear();
  }

  const visibility = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const plot = entry.target;
      const batch = pending.get(plot);
      if (!batch || !root?.contains(plot) || !entry.isIntersecting || !entry.intersectionRect.width ||
          !entry.intersectionRect.height || getComputedStyle(plot).visibility === "hidden") continue;
      pending.delete(plot);
      visibility.unobserve(plot);
      for (const { key, type, marks } of batch) {
        if (played.has(key)) continue;
        played.add(key);
        play(type, marks);
      }
    }
  });

  function scan() {
    frame = 0;
    if (!root || reducedMotion.matches) return;
    const selection = pageControls.map(([selector, attr]) => root.querySelector(selector)?.dataset[attr] || "").join("|");
    if (selection !== subpage) {
      subpage = selection;
      resetPlayback();
    }
    const next = new Map();
    charts.forEach(([type, selector, target], chartIndex) => {
      root.querySelectorAll(selector).forEach((plot, index) => {
        const key = chartIndex + ":" + index;
        if (played.has(key)) return;
        const marks = target ? Array.from(plot.querySelectorAll(target)) : [plot];
        if (type === "bars" && !marks.some(mark => parseFloat(mark.style.width) > 0)) return;
        if (marks.length === 0) return;
        if (!next.has(plot)) next.set(plot, []);
        next.get(plot).push({ key, type, marks });
      });
    });
    for (const plot of pending.keys()) {
      if (!next.has(plot)) {
        visibility.unobserve(plot);
        pending.delete(plot);
      }
    }
    for (const [plot, batch] of next) {
      if (!pending.has(plot)) visibility.observe(plot);
      pending.set(plot, batch);
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(scan);
  }

  const updates = new MutationObserver((records) => {
    if (records.some(record => record.attributeName !== "class" ||
        record.target.matches("[data-view], [data-act='page'], [data-act='tab']"))) schedule();
  });

  function activate(nextRoot, replay = false) {
    if (root === nextRoot && !replay) return;
    updates.disconnect();
    resetPlayback();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    subpage = "";
    root = nextRoot;
    if (!root || reducedMotion.matches) return;
    updates.observe(root, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["class", "aria-current", "aria-selected", "hidden"]
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
