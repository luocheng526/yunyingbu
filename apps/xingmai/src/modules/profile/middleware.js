import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { navMarkup } from "../home/nav-items.js";
import { currentUser, publicProfile } from "./auth.js";

// xm-upgrade-mask 0.1.52  必须和 home/pages.js 成套发，禁止只换本文件。
// xm-fast-shell 0.1.117

export const SHELL_ASSET_VER = "0.1.117";
export const TAB_TITLE = "星脉甄选运营中心";
// 浏览器标签图标走真实文件。Chrome 标签栏经常不画 data: 内嵌图，会变成地球。
// 侧栏品牌条仍用 /login-logo.png，不要改成这个。
export const TAB_ICON = `/shared/tab-icon.png?v=${SHELL_ASSET_VER}`;
const TAB_ICON_PNG = Buffer.from(
  "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",
  "base64"
);
const TAB_ICON_ICO = Buffer.from(
  "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",
  "base64"
);
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
    <link rel="icon" type="image/png" sizes="32x32" href="${TAB_ICON}" />
    <link rel="shortcut icon" href="/favicon.ico?v=${SHELL_ASSET_VER}" />
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
  return `<link rel="icon" type="image/png" sizes="32x32" href="${TAB_ICON}" /><link rel="shortcut icon" href="/favicon.ico?v=${SHELL_ASSET_VER}" />`;
}

export function applyTabIcon(html) {
  const text = String(html || "").replace(/<link\s+rel=["']shortcut icon["'][^>]*>\s*/gi, "");
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


function serveTabIcon(req, res) {
  if (!isReadMethod(req)) {
    return false;
  }
  const dest = normalizedPath(req);
  if (dest !== "/favicon.ico" && dest !== "/shared/tab-icon.png") {
    return false;
  }
  // 闸门 contents 按 UTF-8 落盘时，latin1 二进制会变成 C2 89 PNG。磁盘上的图即使在也不能信。
  const versioned = Boolean(req.query && req.query.v);
  res.setHeader("Cache-Control", versioned ? "public, max-age=86400, immutable" : "no-cache");
  if (dest === "/favicon.ico") {
    res.type("image/x-icon");
    res.send(TAB_ICON_ICO);
    return true;
  }
  res.type("png");
  res.send(TAB_ICON_PNG);
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
  res.redirect(302, "/home");
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
    if (serveTabIcon(req, res)) {
      return;
    }
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
