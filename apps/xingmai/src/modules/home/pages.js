import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NAV_ITEMS } from "./nav-items.js";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../public");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
        const html = withSharedShell(fs.readFileSync(filePath, "utf8"));
        res.status(200).type("html").send(html);
        return;
      }
      res
        .status(200)
        .type("html")
        .set("Content-Type", "text/html; charset=utf-8")
        .send(placeholderHtml(item.label));
    });
  }
}
