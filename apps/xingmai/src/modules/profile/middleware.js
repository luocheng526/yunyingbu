import fs from "node:fs";
import { currentUser } from "./auth.js";

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
    return withThemeBoot(text);
  }
  let out = text;
  if (out.includes("</head>")) {
    const extras = [];
    if (!out.includes("/shared/layout.css")) {
      extras.push('    <link rel="stylesheet" href="/shared/layout.css" />');
    } else if (!out.includes('rel="preload" href="/shared/layout.css"')) {
      extras.push('    <link rel="preload" href="/shared/layout.css" as="style" />');
    }
    if (!out.includes("/shared/nav.js")) {
      extras.push('    <link rel="preload" href="/shared/nav.js" as="script" />');
      extras.push('    <script src="/shared/nav.js" defer></script>');
    } else if (!out.includes('rel="preload" href="/shared/nav.js"')) {
      extras.push('    <link rel="preload" href="/shared/nav.js" as="script" />');
    }
    if (extras.length) {
      out = out.replace("</head>", extras.join("\n") + "\n  </head>");
    }
  } else if (!out.includes("/shared/nav.js") && out.includes("</body>")) {
    out = out.replace("</body>", '    <script src="/shared/nav.js"></script>\n  </body>');
  }
  return withThemeBoot(out);
}

export function injectHtmlShell(req, res, next) {
  const send = res.send.bind(res);
  res.send = function injectSend(body) {
    if (typeof body === "string" && /<html[\s>]/i.test(body)) {
      res.setHeader("Cache-Control", "private, no-store");
      return send(withSharedShell(body));
    }
    return send(body);
  };
  const sendFile = res.sendFile.bind(res);
  res.sendFile = function injectSendFile(filePath, options, callback) {
    const dest = String(filePath || "");
    if (/\.html?$/i.test(dest)) {
      try {
        const html = withSharedShell(fs.readFileSync(dest, "utf8"));
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

export function requireLoginUnlessPublic(req, res, next) {
  if (isPublicRequest(req)) {
    next();
    return;
  }
  const user = currentUser(req);
  if (user) {
    req.user = user;
    next();
    return;
  }
  if (normalizedPath(req).startsWith("/api/")) {
    res.status(401).json({ ok: false, error: "未登录" });
    return;
  }
  res.redirect("/login");
}
