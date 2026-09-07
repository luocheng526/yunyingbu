import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as profileShell from "../profile/middleware.js";
import { NAV_ITEMS } from "./nav-items.js";

// xm-upgrade-mask 0.1.44  必须和 profile/middleware.js 成套发。

function renderExistingPage(filePath) {
  if (typeof profileShell.readThemedHtml === "function") {
    return profileShell.readThemedHtml(filePath);
  }
  return profileShell.withSharedShell(fs.readFileSync(filePath, "utf8"));
}

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../public");
const pageFiles = new Map();
const placeholderPages = new Map();
for (const item of NAV_ITEMS) {
  const filePath = path.join(publicDir, item.file);
  pageFiles.set(item.href, fs.existsSync(filePath) ? filePath : "");
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
  for (const item of NAV_ITEMS) {
    app.get(item.href, (_req, res) => {
      const filePath = pageFiles.get(item.href);
      if (filePath) {
        res.status(200).type("html").set("Cache-Control", "private, no-store").send(renderExistingPage(filePath));
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
