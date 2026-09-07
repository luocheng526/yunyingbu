/** Lower ships first. Foundations before features so a restart still leaves login and the shell intact. */

function fileBlob(item) {
  return (item.files || []).map((rel) => String(rel).replaceAll("\\", "/")).join("\n");
}

export function stabilityScore(item) {
  const files = fileBlob(item);
  const module = String(item.module || "");
  let layer = 80;

  if (/\bpackage(-lock)?\.json\b/.test(files) || files.includes("src/db/")) {
    layer = Math.min(layer, 10);
  }
  if (files.includes("src/modules/profile/")) {
    layer = Math.min(layer, 20);
  }
  if (module === "个人中心") {
    layer = Math.min(layer, 22);
  }
  if (files.includes("public/shared/") || files.includes("src/modules/home/nav")) {
    layer = Math.min(layer, 30);
  }
  if (files.includes("src/app.js") || files.includes("src/server.js")) {
    layer = Math.min(layer, 40);
  }
  if (module === "首页" || files.includes("public/index.html")) {
    layer = Math.min(layer, 50);
  }
  if (module === "数据中心" || files.includes("src/modules/data/") || files.includes("public/data.html")) {
    layer = Math.min(layer, 60);
  }
  if (module === "人员管理" || files.includes("src/modules/people/") || files.includes("public/people.html")) {
    layer = Math.min(layer, 65);
  }
  if (module === "沈子晗" || files.includes("src/modules/shen/") || files.includes("public/shen.html")) {
    layer = Math.min(layer, 70);
  }
  if (module === "韩梦凯" || files.includes("src/modules/han/") || files.includes("public/han.html")) {
    layer = Math.min(layer, 75);
  }
  if (module === "版本发布中心" || files.includes("src/modules/releases/") || files.includes("public/releases")) {
    layer = Math.min(layer, files.includes("public/releases") ? 95 : 90);
  }

  const restartBit = item.restart ? 0 : 1;
  return layer * 10 + restartBit;
}

export function compareStability(a, b) {
  const sa = stabilityScore(a);
  const sb = stabilityScore(b);
  if (sa !== sb) {
    return sa - sb;
  }
  const ta = String(a.submittedAt || "");
  const tb = String(b.submittedAt || "");
  if (ta !== tb) {
    return ta.localeCompare(tb);
  }
  return String(a.id || "").localeCompare(String(b.id || ""));
}

export function assignStablePriorities(queued) {
  const ordered = (queued || []).slice().sort(compareStability);
  ordered.forEach((item, index) => {
    item.priority = index + 1;
  });
  return ordered;
}
