import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as profileShell from "../profile/middleware.js";
import { NAV_ITEMS } from "./nav-items.js";

// xm-upgrade-mask 0.1.52  必须和 profile/middleware.js 成套发。
// xm-fast-shell 0.1.116

function renderExistingPage(filePath) {
  if (typeof profileShell.readThemedHtml === "function") {
    return profileShell.readThemedHtml(filePath);
  }
  return profileShell.withSharedShell(fs.readFileSync(filePath, "utf8"));
}

function renderRouteShell(href, user) {
  const key = String(href || "/").replace(/\/+$/, "") || "/";
  if (typeof profileShell.renderAppShell === "function") {
    return profileShell.renderAppShell(href, user);
  }
  return renderExistingPage(pageFiles.get(href) || path.join(publicDir, "data.html"));
}

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../public");
const pageFiles = new Map();
const placeholderPages = new Map();
for (const item of NAV_ITEMS) {
  const filePath = item.file ? path.join(publicDir, item.file) : "";
  pageFiles.set(item.href, filePath && fs.existsSync(filePath) ? filePath : "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export const withSharedShell = profileShell.withSharedShell;

function placeholderHtml(label) {
  const title = escapeHtml(label);
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} · 运营部</title>
    <link rel="stylesheet" href="/shared/layout.css" />
  </head>
  <body>
    <div id="site-nav" hidden></div>
    <main class="page">
      <p class="kicker">星脉</p>
      <h1>${title}</h1>
      <p class="lead">该模块 Agent 尚未交付</p>
    </main>
    <script src="/shared/nav.js"></script>
  </body>
</html>
`;
}

for (const item of NAV_ITEMS) {
  if (!pageFiles.get(item.href)) {
    placeholderPages.set(item.href, profileShell.withSharedShell(placeholderHtml(item.label)));
  }
}

export function registerPageRoutes(app) {
  app.use((req, res, next) => {
    const method = String(req.method || "GET").toUpperCase();
    const path = String(req.path || "").replace(/\/+$/, "") || "/";
    if ((method === "GET" || method === "HEAD") && (path === "/" || path === "/index.html")) {
      res.redirect(302, "/home");
      return;
    }
    if ((method === "GET" || method === "HEAD") && path === "/data") {
      res.redirect(302, "/data/overview");
      return;
    }
    next();
  });
  app.get("/data", (_req, res) => {
    res.redirect(302, "/data/overview");
  });
  app.get("/shen", (_req, res) => {
    res.redirect(302, "/shen/selection");
  });
  app.get("/han", (_req, res) => {
    res.redirect(302, "/han/selection");
  });
  app.get("/academy", (_req, res) => {
    res.redirect(302, "/academy/courses");
  });
  for (const item of NAV_ITEMS) {
    app.get(item.href, (req, res) => {
      if (pageFiles.get(item.href) || typeof profileShell.renderAppShell === "function") {
        res.status(200).type("html").set("Cache-Control", "private, no-store").send(renderRouteShell(item.href, req.user));
        return;
      }
      let ready = placeholderPages.get(item.href);
      if (!ready) {
        ready = profileShell.withSharedShell(placeholderHtml(item.label));
        placeholderPages.set(item.href, ready);
      }
      res.status(200).type("html").set("Cache-Control", "private, no-store").send(ready);
    });
  }
}
