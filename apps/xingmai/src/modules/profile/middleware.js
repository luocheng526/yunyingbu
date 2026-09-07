import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { currentUser } from "./auth.js";

// xm-lag-risks 0.1.41  必须和 home/pages.js 成套发，禁止只换本文件。

export const SHELL_ASSET_VER = "0.1.41";
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../public");
const SHELL_ASSET_FILES = {
  "/shared/nav.js": "shared/nav.js",
  "/shared/layout.css": "shared/layout.css",
  "/login.css": "login.css"
};
const htmlFileCache = new Map();
const HTML_CACHE_MS = 60_000;

function versionShellAssets(text) {
  return String(text || "")
    .replace(/\/shared\/layout\.css(?:\?[^"'>\s]*)?/g, `/shared/layout.css?v=${SHELL_ASSET_VER}`)
    .replace(/\/shared\/nav\.js(?:\?[^"'>\s]*)?/g, `/shared/nav.js?v=${SHELL_ASSET_VER}`);
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

export function withSharedShell(html) {
  const text = String(html || "");
  if (/class=["']login-page["']/.test(text) || /href=["']\/login\.css["']/.test(text)) {
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
  const html = withSharedShell(fs.readFileSync(dest, "utf8"));
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
        /class=["']login-page["']/.test(body) ||
        /href=["']\/login\.css["']/.test(body)
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

function serveShellAsset(req, res) {
  if (!isReadMethod(req)) {
    return false;
  }
  const rel = SHELL_ASSET_FILES[normalizedPath(req)];
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
  const dest = path.join(publicDir, "index.html");
  res.status(200).type("html").set("Cache-Control", "private, no-store").send(readThemedHtml(dest));
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
    if (serveHomeIndex(req, res)) {
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
