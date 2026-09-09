import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { navMarkup } from "../home/nav-items.js";
import { currentUser, publicProfile } from "./auth.js";

// xm-upgrade-mask 0.1.52  必须和 home/pages.js 成套发，禁止只换本文件。
// xm-fast-shell 0.1.113

export const SHELL_ASSET_VER = "0.1.113";
export const TAB_TITLE = "星脉甄选运营中心";
// 浏览器标签图标。侧栏品牌条仍用 /login-logo.png，不要改成这个。
export const TAB_ICON =
  "data:image/png;base64,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";
export const APP_MODULES = {
  "/home": "home",
  "/data": "data",
  "/data/overview": "data",
  "/data/shops": "data",
  "/data/goods": "data",
  "/data/paid": "data",
  "/shen": "shen",
  "/shen/selection": "shen",
  "/shen/growth": "shen",
  "/shen/paid": "shen",
  "/shen/training": "shen",
  "/shen/tasks": "shen",
  "/han": "han",
  "/han/selection": "han",
  "/han/goods": "han",
  "/han/paid": "han",
  "/han/training": "han",
  "/people": "people",
  "/academy": "academy",
  "/academy/courses": "academy",
  "/academy/exams": "academy",
  "/academy/handbook": "academy",
  "/agents": "agents",
  "/releases": "releases",
  "/me": "me"
};
const SHELL_TITLES = {
  "/home": "首页",
  "/data": "数据中心",
  "/data/overview": "数据总揽",
  "/data/shops": "店铺数据",
  "/data/goods": "商品数据",
  "/data/paid": "实时付费",
  "/shen": "沈子晗运营中心",
  "/shen/selection": "选品中心",
  "/shen/growth": "商品成长",
  "/shen/paid": "实时付费",
  "/shen/training": "培训系统",
  "/shen/tasks": "任务管理",
  "/han": "韩梦凯运营中心",
  "/han/selection": "选品数据",
  "/han/goods": "商品数据",
  "/han/paid": "实时付费",
  "/han/training": "培训系统",
  "/people": "组织中心",
  "/academy": "甄选商学院",
  "/academy/courses": "培训课程",
  "/academy/exams": "培训考试",
  "/academy/handbook": "运营手册",
  "/agents": "甄选智能体",
  "/releases": "版本发布中心",
  "/me": "个人中心"
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function injectBootUser(html, user) {
  const text = String(html || "");
  if (!user || !user.username || text.includes("__xmBootUser")) {
    return text;
  }
  const tag = `    <script>window.__xmBootUser=${JSON.stringify(publicProfile(user))};</script>\n`;
  if (text.includes("</head>")) {
    return text.replace("</head>", tag + "  </head>");
  }
  return tag + text;
}

export function renderAppShell(href, user) {
  const key = String(href || "/").replace(/\/+$/, "") || "/";
  const id = APP_MODULES[key] || "data";
  const title = SHELL_TITLES[key] || "星脉";
  const css =
    key === "/releases"
      ? `    <link rel="stylesheet" href="/releases.css?v=${SHELL_ASSET_VER}" />\n`
      : "";
  const boot =
    user && user.username
      ? `    <script>window.__xmBootUser=${JSON.stringify(publicProfile(user))};</script>\n`
      : "";
  const userName = escapeHtml((user && (user.displayName || user.username)) || "用户");
  return withSharedShell(`<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${TAB_TITLE}</title>
    <link rel="icon" type="image/png" href="${TAB_ICON}" />
${css}    <link rel="preload" href="/shared/modules/${id}.js?v=${SHELL_ASSET_VER}" as="script" />
${boot}    <script src="/shared/modules/${id}.js?v=${SHELL_ASSET_VER}" defer data-xm-mod="${key}"></script>
  </head>
  <body class="xm-app xm-app-shell">
    <div class="xm-shell">
      ${navMarkup(key)}
      <div class="xm-main">
        <header class="xm-topbar">
          <div class="xm-tabs" role="tablist" aria-label="页签"><div class="xm-tab is-active" role="tab" data-href="${key}" aria-selected="true"><span class="xm-tab-label">${title}</span><button type="button" class="xm-tab-close" aria-label="关闭 ${title}">×</button></div></div>
          <div class="xm-user">
            <div class="xm-styles" role="group" aria-label="页面风格"><button type="button" data-xm-style="light" title="正常蓝色">蓝</button><button type="button" data-xm-style="dark" title="晚上黑色">夜</button><button type="button" data-xm-style="pink" title="甄选粉">粉</button></div>
            <time class="xm-date" id="xm-date"></time>
            <button type="button" class="xm-refresh" id="xm-refresh">刷新</button>
            <a class="xm-username" id="xm-username" href="/me">${userName}</a>
          </div>
        </header>
        <div class="xm-workspace"><div class="xm-content xm-pane is-active" id="xm-content" data-xm-href="${key}"></div></div>
      </div>
    </div>
    <script>
      document.addEventListener("DOMContentLoaded", function () {
        var key = ${JSON.stringify(key)};
        var root = document.getElementById("xm-content");
        if (!root || key === "/") return;
        if (root.getAttribute("data-xm-mounted") || root.getAttribute("data-xm-rel-mounted") === "1") return;
        var mod = window.XmModules && window.XmModules[key];
        if (!mod || typeof mod.mount !== "function") return;
        root.setAttribute("data-xm-mounted", key);
        if (key === "/releases") root.setAttribute("data-xm-rel-mounted", "1");
        window.__xmUnmount = mod.mount(root);
      });
    </script>
  </body>
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
const gzipFileCache = new Map();

function gzipBuffer(raw) {
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw));
  if (buf.length < 256) {
    return null;
  }
  return zlib.gzipSync(buf, { level: 6 });
}

function attachGzip(req, res) {
  if (res.__xmGzipAttached) {
    return;
  }
  res.__xmGzipAttached = true;
  const send = res.send.bind(res);
  res.send = function gzipSend(body) {
    if (res.headersSent || res.getHeader("content-encoding")) {
      return send(body);
    }
    if (typeof body !== "string" && !Buffer.isBuffer(body)) {
      return send(body);
    }
    const type = String(res.getHeader("content-type") || "");
    if (type && !/html|json|javascript|ecmascript|css|svg|xml|text\//i.test(type)) {
      return send(body);
    }
    const raw = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    const accept = String(req.headers["accept-encoding"] || "");
    if (raw.length < 256 || !/\bgzip\b/i.test(accept)) {
      return send(body);
    }
    const gz = gzipBuffer(raw);
    if (!gz || gz.length >= raw.length) {
      return send(body);
    }
    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Vary", "Accept-Encoding");
    res.removeHeader("Content-Length");
    return send(gz);
  };
}
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
  '    <script>try{var t=localStorage.getItem("xm-theme");if(t==="dark"||t==="light"||t==="pink"){document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t==="dark"?"dark":"light";}}catch(e){}</script>\n';

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

function tabIconTag() {
  return `<link rel="icon" type="image/png" href="${TAB_ICON}" />`;
}

export function applyTabIcon(html) {
  const text = String(html || "");
  if (/<link\s+rel=["']icon["'][^>]*>/i.test(text)) {
    return text.replace(/<link\s+rel=["']icon["'][^>]*>/i, tabIconTag());
  }
  if (text.includes("</head>")) {
    return text.replace("</head>", `    ${tabIconTag()}\n  </head>`);
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
    return versionShellAssets(withThemeBoot(applyTabIcon(text)));
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
    if (!/rel=["']icon["']/.test(out)) {
      extras.push(`    ${tabIconTag()}`);
    } else {
      out = applyTabIcon(out);
    }
    if (extras.length) {
      out = out.replace("</head>", extras.join("\n") + "\n  </head>");
    }
    out = out.replace(/<title>[^<]*<\/title>/, `<title>${TAB_TITLE}</title>`);
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
  const html = /login\.html$/i.test(dest)
    ? versionShellAssets(withThemeBoot(applyTabIcon(raw)))
    : withSharedShell(raw);
  htmlFileCache.set(dest, { mtimeMs: stat.mtimeMs, size: stat.size, html, at: now });
  return html;
}

export function injectHtmlShell(req, res, next) {
  attachGzip(req, res);
  const send = res.send.bind(res);
  res.send = function injectSend(body) {
    if (typeof body === "string" && /<html[\s>]/i.test(body)) {
      res.setHeader("Cache-Control", "private, no-store");
      let html = body;
      if (
        !html.includes(`/shared/nav.js?v=${SHELL_ASSET_VER}`) &&
        !isLoginHtml(html)
      ) {
        html = withSharedShell(html);
      }
      if (req.user) {
        html = injectBootUser(html, req.user);
      }
      return send(html);
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
  const abs = path.join(publicDir, rel);
  if (/\.(?:js|css)$/i.test(rel)) {
    const stat = fs.statSync(abs);
    const cacheKey = `${abs}:${stat.mtimeMs}:${stat.size}`;
    let hit = gzipFileCache.get(cacheKey);
    if (!hit) {
      const raw = fs.readFileSync(abs);
      hit = { raw, gz: gzipBuffer(raw) };
      gzipFileCache.set(cacheKey, hit);
    }
    res.type(rel.endsWith(".css") ? "css" : "js");
    const accept = String(req.headers["accept-encoding"] || "");
    if (hit.gz && hit.gz.length < hit.raw.length && /\bgzip\b/i.test(accept)) {
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Vary", "Accept-Encoding");
      res.send(hit.gz);
      return true;
    }
    res.send(hit.raw);
    return true;
  }
  res.sendFile(abs);
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
  res.redirect(302, "/data");
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
  attachGzip(req, res);
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
