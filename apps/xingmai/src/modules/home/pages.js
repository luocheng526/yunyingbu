import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as profileShell from "../profile/middleware.js";
import { NAV_ITEMS } from "./nav-items.js";

// 必须和 middleware.js 成套发布。命名导入 readThemedHtml 会在旧 middleware 上直接把进程打挂。
function renderExistingPage(filePath) {
  if (typeof profileShell.readThemedHtml === "function") {
    return profileShell.readThemedHtml(filePath);
  }
  return profileShell.withSharedShell(fs.readFileSync(filePath, "utf8"));
}

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../public");

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

export function registerPageRoutes(app) {
  for (const item of NAV_ITEMS) {
    app.get(item.href, (_req, res) => {
      const filePath = path.join(publicDir, item.file);
      if (fs.existsSync(filePath)) {
        res.status(200).type("html").send(renderExistingPage(filePath));
        return;
      }
      res
        .status(200)
        .type("html")
        .set("Content-Type", "text/html; charset=utf-8")
        .send(profileShell.withSharedShell(placeholderHtml(item.label)));
    });
  }
}
