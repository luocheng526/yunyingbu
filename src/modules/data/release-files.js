/**
 * Only these paths may go to the release gate as contents.
 * Cloud src/app.js is a local stub. Shipping it replaces the live site.
 */
export const DATA_OVERLAY_FILES = [
  "public/data.html",
  "public/data-pages.css",
  "public/data-subnav.js",
  "public/data-store-live.html",
  "public/data-store-overview.html",
  "public/data-goods-overview.html",
  "public/data/placeholder/index.html",
  "public/data/overview/index.html",
  "public/data-overview.js",
  "public/data-shops.js",
  "public/data/team-demo.json",
  "public/data/shops-demo.json",
  "src/modules/data/overview.js",
  "src/modules/data/nav.js",
  "src/modules/data/pages.js",
  "src/modules/data/router.js",
  "src/modules/data/patch-app.js",
  "src/modules/data/release-files.js",
  "public/data/shops/index.html",
  "public/data/goods/index.html",
  "public/data/paid/index.html",
  "public/shared/modules/data.js"
];

const ALLOWED_SHARED = new Set(["public/shared/modules/data.js"]);

const FORBIDDEN_EXACT = new Set([
  "src/app.js",
  "src/server.js",
  "src/notes-store.js",
  "public/index.html",
  "package.json"
]);

const FORBIDDEN_PREFIXES = [
  "public/shared/",
  "src/modules/home/",
  "src/modules/han/",
  "src/modules/shen/",
  "src/modules/people/",
  "src/modules/profile/",
  "src/modules/releases/",
  "src/db/"
];

export function isForbiddenReleasePath(relPath) {
  const n = String(relPath || "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (ALLOWED_SHARED.has(n)) {
    return false;
  }
  if (FORBIDDEN_EXACT.has(n)) {
    return true;
  }
  return FORBIDDEN_PREFIXES.some((prefix) => n.startsWith(prefix));
}

export function isAllowedDataPath(relPath) {
  const n = String(relPath || "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (ALLOWED_SHARED.has(n)) {
    return true;
  }
  if (isForbiddenReleasePath(n)) {
    return false;
  }
  return DATA_OVERLAY_FILES.includes(n) || n.startsWith("public/data") || n.startsWith("src/modules/data/");
}

export function assertDataOnlyPaths(paths, label = "release files") {
  const list = [...paths];
  const bad = list.filter((p) => !isAllowedDataPath(p));
  if (bad.length) {
    throw new Error(
      `${label} 超出数据中心范围，拒绝提交以免覆盖整站：${bad.join("、")}。只允许 public/data* 与 src/modules/data/*。`
    );
  }
  return list;
}
