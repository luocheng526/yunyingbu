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

export function withSharedShell(html) {
  const text = String(html || "");
  if (/class=["']login-page["']/.test(text) || /href=["']\/login\.css["']/.test(text)) {
    return text;
  }
  let out = text;
  if (!out.includes("/shared/layout.css") && out.includes("</head>")) {
    out = out.replace("</head>", '    <link rel="stylesheet" href="/shared/layout.css" />\n  </head>');
  }
  if (!out.includes("/shared/nav.js") && out.includes("</body>")) {
    out = out.replace("</body>", '    <script src="/shared/nav.js"></script>\n  </body>');
  }
  return out;
}

export function injectHtmlShell(req, res, next) {
  const send = res.send.bind(res);
  res.send = function injectSend(body) {
    if (typeof body === "string" && /<html[\s>]/i.test(body)) {
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
