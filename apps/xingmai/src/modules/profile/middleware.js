import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { currentUser, publicProfile } from "./auth.js";

// xm-upgrade-mask 0.1.52  必须和 home/pages.js 成套发，禁止只换本文件。

export const SHELL_ASSET_VER = "0.1.82";
export const APP_MODULES = {
  "/": "home",
  "/data": "data",
  "/shen": "shen",
  "/han": "han",
  "/people": "people",
  "/releases": "releases",
  "/me": "me"
};

export function renderAppShell(href, user) {
  const key = String(href || "/").replace(/\/+$/, "") || "/";
  const id = APP_MODULES[key] || "home";
  const preloads = Object.values(APP_MODULES)
    .map((name) => `    <link rel="preload" href="/shared/modules/${name}.js?v=${SHELL_ASSET_VER}" as="script" />`)
    .join("\n");
  const boot =
    user && user.username
      ? `    <script>window.__xmBootUser=${JSON.stringify(publicProfile(user))};</script>\n`
      : "";
  return withSharedShell(`<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>星脉</title>
    <link rel="preload" href="/releases.css?v=${SHELL_ASSET_VER}" as="style" />
${preloads}
${boot}    <script src="/shared/modules/${id}.js?v=${SHELL_ASSET_VER}" defer data-xm-mod="${key}"></script>
  </head>
  <body class="xm-app-shell"></body>
</html>`);
}
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../public");
const SHELL_ASSET_FILES = {
  "/shared/nav.js": "shared/nav.js",
  "/shared/layout.css": "shared/layout.css",
  "/login.css": "login.css",
  "/releases.css": "releases.css"
};
const htmlFileCache = new Map();
const HTML_CACHE_MS = 60_000;
const HAN_API_CACHE_MS = 2500;
const HAN_API_PATHS = new Set([
  "/api/han/tasks",
  "/api/han/brief",
  "/api/data/overview",
  "/api/shen/tasks",
  "/api/shen/brief",
  "/api/people",
  "/api/auth/me",
  "/api/releases",
  "/api/releases/queue",
  "/api/releases/lock",
  "/api/releases/versions",
  "/api/releases/readyz"
]);
const hanApiCache = new Map();

function versionShellAssets(text) {
  return String(text || "")
    .replace(/\/shared\/layout\.css(?:\?[^"'>\s]*)?/g, `/shared/layout.css?v=${SHELL_ASSET_VER}`)
    .replace(/\/shared\/nav\.js(?:\?[^"'>\s]*)?/g, `/shared/nav.js?v=${SHELL_ASSET_VER}`)
    .replace(/\/shared\/modules\/([a-z]+)\.js(?:\?[^"'>\s]*)?/g, `/shared/modules/$1.js?v=${SHELL_ASSET_VER}`)
    .replace(/\/releases\.css(?:\?[^"'>\s]*)?/g, `/releases.css?v=${SHELL_ASSET_VER}`);
}

function normalizedPath(req) {
  const raw = String(req.path || "/");
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed || "/";
}

export function isPublicRequest(req) {
  const method = String(req.method || "GET").toUpperCase();
  const path = normalizedPath(req);
  if (method === "GET" || method === "HEAD") {
    if (
      path === "/login" ||
      path === "/login.css" ||
      path === "/api/health" ||
      path === "/shared/layout.css" ||
      path === "/shared/nav.js"
    ) {
      return true;
    }
    if (/\.(?:css|js|woff2?|png|jpe?g|gif|svg|ico|webp)$/i.test(path)) {
      return true;
    }
  }
  if (method === "POST" && (path === "/api/auth/login" || path === "/api/auth/logout")) {
    return true;
  }
  return false;
}

const THEME_BOOT =
  '    <script>try{var t=localStorage.getItem("xm-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;}}catch(e){}</script>\n';

export function withThemeBoot(html) {
  const text = String(html || "");
  if (text.includes('localStorage.getItem("xm-theme")')) {
    return text;
  }
  if (text.includes("</head>")) {
    return text.replace("</head>", THEME_BOOT + "  </head>");
  }
  return text;
}

export function isLoginHtml(html) {
  const text = String(html || "");
  return (
    /class=["'][^"']*\blogin-page\b/.test(text) ||
    /href=["']\/login\.css(?:\?[^"']*)?["']/.test(text)
  );
}

export function withSharedShell(html) {
  const text = String(html || "");
  if (isLoginHtml(text)) {
    return versionShellAssets(withThemeBoot(text));
  }
  let out = text;
  if (out.includes("</head>")) {
    const extras = [];
    if (!out.includes("/shared/layout.css")) {
      extras.push(`    <link rel="stylesheet" href="/shared/layout.css?v=${SHELL_ASSET_VER}" />`);
    } else if (!out.includes('rel="preload" href="/shared/layout.css')) {
      extras.push(`    <link rel="preload" href="/shared/layout.css?v=${SHELL_ASSET_VER}" as="style" />`);
    }
    if (!out.includes("/shared/nav.js")) {
      extras.push(`    <link rel="preload" href="/shared/nav.js?v=${SHELL_ASSET_VER}" as="script" />`);
      extras.push(`    <script src="/shared/nav.js?v=${SHELL_ASSET_VER}" defer></script>`);
    } else if (!out.includes('rel="preload" href="/shared/nav.js')) {
      extras.push(`    <link rel="preload" href="/shared/nav.js?v=${SHELL_ASSET_VER}" as="script" />`);
    }
    if (extras.length) {
      out = out.replace("</head>", extras.join("\n") + "\n  </head>");
    }
  } else if (!out.includes("/shared/nav.js") && out.includes("</body>")) {
    out = out.replace("</body>", `    <script src="/shared/nav.js?v=${SHELL_ASSET_VER}"></script>\n  </body>`);
  }
  return versionShellAssets(withThemeBoot(out));
}

// 首页 pages.js 会调用本函数。只发 middleware、不发匹配的 pages.js（或反过来）会让进程起不来。
export function readThemedHtml(filePath) {
  const dest = String(filePath || "");
  const now = Date.now();
  const hit = htmlFileCache.get(dest);
  if (hit && now - hit.at < HTML_CACHE_MS) {
    return hit.html;
  }
  const stat = fs.statSync(dest);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) {
    hit.at = now;
    return hit.html;
  }
  const raw = fs.readFileSync(dest, "utf8");
  const html = /login\.html$/i.test(dest) ? versionShellAssets(withThemeBoot(raw)) : withSharedShell(raw);
  htmlFileCache.set(dest, { mtimeMs: stat.mtimeMs, size: stat.size, html, at: now });
  return html;
}

export function injectHtmlShell(req, res, next) {
  const send = res.send.bind(res);
  res.send = function injectSend(body) {
    if (typeof body === "string" && /<html[\s>]/i.test(body)) {
      res.setHeader("Cache-Control", "private, no-store");
      if (
        body.includes(`/shared/nav.js?v=${SHELL_ASSET_VER}`) ||
        isLoginHtml(body)
      ) {
        return send(body);
      }
      return send(withSharedShell(body));
    }
    return send(body);
  };
  const sendFile = res.sendFile.bind(res);
  res.sendFile = function injectSendFile(filePath, options, callback) {
    const dest = String(filePath || "");
    if (/\.html?$/i.test(dest)) {
      try {
        const html = readThemedHtml(dest);
        res.type("html");
        res.setHeader("Cache-Control", "private, no-store");
        return send(html);
      } catch (err) {
        if (typeof callback === "function") {
          callback(err);
          return res;
        }
        next(err);
        return res;
      }
    }
    return sendFile(filePath, options, callback);
  };
  next();
}

function isReadMethod(req) {
  const method = String(req.method || "GET").toUpperCase();
  return method === "GET" || method === "HEAD";
}

function shellAssetRel(pathname) {
  if (SHELL_ASSET_FILES[pathname]) {
    return SHELL_ASSET_FILES[pathname];
  }
  const match = String(pathname || "").match(/^\/shared\/modules\/([a-z]+)\.js$/);
  if (match && Object.values(APP_MODULES).includes(match[1])) {
    return `shared/modules/${match[1]}.js`;
  }
  return "";
}

function serveShellAsset(req, res) {
  if (!isReadMethod(req)) {
    return false;
  }
  const rel = shellAssetRel(normalizedPath(req));
  if (!rel) {
    return false;
  }
  const versioned = Boolean(req.query && req.query.v);
  res.setHeader(
    "Cache-Control",
    versioned ? "public, max-age=86400, immutable" : "public, max-age=0, must-revalidate"
  );
  res.sendFile(path.join(publicDir, rel));
  return true;
}

function serveHomeIndex(req, res) {
  if (!isReadMethod(req)) {
    return false;
  }
  const destPath = normalizedPath(req);
  if (destPath !== "/" && destPath !== "/index.html") {
    return false;
  }
  res.status(200).type("html").set("Cache-Control", "private, no-store").send(readThemedHtml(path.join(publicDir, "index.html")));
  return true;
}

function dropHanApiCache(req) {
  const method = String(req.method || "GET").toUpperCase();
  const dest = normalizedPath(req);
  if (method === "GET" || method === "HEAD") {
    return;
  }
  if (dest.startsWith("/api/")) {
    hanApiCache.clear();
  }
}

function serveHanApiCache(req, res) {
  if (!isReadMethod(req)) {
    return false;
  }
  const dest = normalizedPath(req);
  if (!HAN_API_PATHS.has(dest)) {
    return false;
  }
  const hit = hanApiCache.get(dest);
  if (!hit || Date.now() - hit.at >= HAN_API_CACHE_MS) {
    const json = res.json.bind(res);
    res.json = function cacheHanJson(body) {
      if (res.statusCode === 200) {
        hanApiCache.set(dest, { at: Date.now(), body });
      }
      return json(body);
    };
    return false;
  }
  res.status(200).type("json").set("X-Xm-Cache", "han").json(hit.body);
  return true;
}

export function requireLoginUnlessPublic(req, res, next) {
  if (isPublicRequest(req)) {
    if (serveShellAsset(req, res)) {
      return;
    }
    next();
    return;
  }
  const user = currentUser(req);
  if (user) {
    req.user = user;
    dropHanApiCache(req);
    if (serveHomeIndex(req, res)) {
      return;
    }
    if (serveHanApiCache(req, res)) {
      return;
    }
    next();
    return;
  }
  if (normalizedPath(req).startsWith("/api/")) {
    res.status(401).json({ ok: false, error: "未登录" });
    return;
  }
  res.redirect("/login");
}
